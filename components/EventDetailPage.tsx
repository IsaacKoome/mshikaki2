// component/EventDetailPage.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  updateDoc,
  onSnapshot,
  Timestamp,
  arrayUnion,
  addDoc,
  orderBy,
  limit,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CalendarIcon,
  MapPinIcon,
  InfoIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  ImageIcon,
  VideoIcon,
  UploadCloudIcon,
  MessageCircleIcon,
  SendIcon,
  HeartIcon,
  Trash2Icon,
  Share2Icon,
  UsersIcon,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface CommunityMessage {
  id: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'video' | 'file';
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  likes?: string[];
}

interface EventData {
  title: string;
  location: string;
  images: string[];
  videos?: string[];
  goal: number;
  raised?: number;
  story?: string;
  date?: string;
  contributionNote?: string;
  beneficiaryPhone?: string;
  ownerId?: string;
  [key: string]: any;
}

interface Contribution {
  id: string;
  amount: number;
  name: string;
  phone: string;
  timestamp: Timestamp;
  mpesaReceiptNumber?: string;
  status?: string;
}

interface Participant {
  uid: string;
  displayName: string;
  photoURL?: string;
  isOwner: boolean;
}

interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

export default function EventDetailPage({ id, collectionName }: Props) {
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<number | "">(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contributionsTotal, setContributionsTotal] = useState(0);
  const [contributionList, setContributionList] = useState<Contribution[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const router = useRouter();

  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [mpesaMessage, setMpesaMessage] = useState<string | null>(null);
  const [isSubmittingGift, setIsSubmittingGift] = useState(false);

  const [newImages, setNewImages] = useState<FileList | null>(null);
  const [newVideos, setNewVideos] = useState<FileList | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadMediaMessage, setUploadMediaMessage] = useState<string | null>(null);

  const [chatMessage, setChatMessage] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<CommunityMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedChatImage, setSelectedChatImage] = useState<File | null>(null);
  const [selectedChatVideo, setSelectedChatVideo] = useState<File | null>(null);
  const [isSendingChatMedia, setIsSendingChatMedia] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const [showShareOptions, setShowShareOptions] = useState(false);
  const [communityParticipants, setCommunityParticipants] = useState<Participant[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);


  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (chatContainer) {
        const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 100;
        if (isScrolledToBottom || (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].senderId === user?.uid)) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }
  }, [chatMessages, user?.uid]);


  // Effect 1: Fetch Event Data (runs once or when id/collectionName changes)
  useEffect(() => {
    const fetchEventData = async () => {
      const ref = doc(db, collectionName, id);
      try {
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setEvent(snapshot.data() as EventData);
        } else {
          setEvent(null);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };
    fetchEventData();
  }, [id, collectionName]); // Dependencies: only the route params

  // Effect 2: Fetch Contributions and Chat Messages (runs when event data is available)
  // This effect depends on 'event' being non-null.
  useEffect(() => {
    // Guard: Do not proceed if event data is not yet loaded
    if (!event) return;

    const fetchContributions = () => {
      const q = query(collection(db, "contributions"), where("eventId", "==", id));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            amount: data.amount || 0,
            name: data.name || "Anonymous",
            phone: data.phone || "",
            timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now(),
            mpesaReceiptNumber: data.mpesaReceiptNumber || undefined,
            status: data.status || undefined,
          } as Contribution;
        });

        const sorted = docs.sort((a, b) => {
          const t1 = (a.timestamp as Timestamp)?.toMillis() || 0;
          const t2 = (b.timestamp as Timestamp)?.toMillis() || 0;
          return t1 - t2;
        });

        const total = sorted.reduce((sum, c) => sum + (c.amount || 0), 0);
        setContributionsTotal(total);
        setContributionList(sorted);
      });
      return unsub;
    };

    const fetchChatMessagesAndParticipants = () => {
        const chatRef = collection(db, collectionName, id, "community_messages");
        const q = query(chatRef, orderBy("timestamp", "asc"));

        const unsub = onSnapshot(q, async (snapshot) => {
            const messages = snapshot.docs.map(docSnapshot => ({
                id: docSnapshot.id,
                ...docSnapshot.data()
            })) as CommunityMessage[];
            setChatMessages(messages);

            const uniqueSenderIds = new Set<string>();
            messages.forEach(msg => uniqueSenderIds.add(msg.senderId));

            const newParticipants: Participant[] = [];
            // Now 'event.ownerId' is safely accessed here because `event` is guaranteed non-null by the outer guard
            if (event.ownerId) {
              newParticipants.push({
                uid: event.ownerId,
                displayName: event.ownerId === user?.uid ? user.displayName || "You" : "Event Owner",
                photoURL: event.ownerId === user?.uid ? user.photoURL || '/default-avatar.png' : '/default-avatar.png',
                isOwner: true,
              });
              uniqueSenderIds.delete(event.ownerId);
            }

            for (const senderId of Array.from(uniqueSenderIds)) {
                if (senderId === user?.uid && user?.displayName) {
                    newParticipants.push({
                        uid: user.uid,
                        displayName: user.displayName,
                        photoURL: user.photoURL || '/default-avatar.png',
                        isOwner: false,
                    });
                } else {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', senderId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            newParticipants.push({
                                uid: senderId,
                                displayName: userData.displayName || 'Anonymous User',
                                photoURL: userData.photoURL || '/default-avatar.png',
                                isOwner: false,
                            });
                        } else {
                            newParticipants.push({
                                uid: senderId,
                                displayName: 'Unknown User',
                                photoURL: '/default-avatar.png',
                                isOwner: false,
                            });
                        }
                    } catch (e) {
                        console.error("Error fetching participant user data:", e);
                        newParticipants.push({
                            uid: senderId,
                            displayName: 'Unknown User',
                            photoURL: '/default-avatar.png',
                            isOwner: false,
                        });
                    }
                }
            }
            newParticipants.sort((a, b) => {
              if (a.isOwner && !b.isOwner) return -1;
              if (!a.isOwner && b.isOwner) return 1;
              return a.displayName.localeCompare(b.displayName);
            });
            setCommunityParticipants(newParticipants);
        }, (error) => {
            console.error("Error fetching chat messages:", error);
        });
        return unsub;
    };


    const unsubContributions = fetchContributions();
    const unsubChatAndParticipants = fetchChatMessagesAndParticipants();

    return () => {
        unsubContributions();
        unsubChatAndParticipants();
    };
  }, [id, collectionName, user?.uid, event]); // This effect now correctly depends on 'event'


  useEffect(() => {
    if (user) {
      setName(user.displayName || "");
    }
  }, [user]);

  const maskPhone = (phone: string) => {
    return phone.length >= 7
      ? phone.slice(0, 2) + "***" + phone.slice(-2)
      : "07***00";
  };

  const handleContribute = async () => {
    if (!amount || amount <= 0 || !name || !phone) {
      alert("Please fill in all fields correctly.");
      return;
    }
    // event is guaranteed non-null here due to the main render guard
    if (!event.beneficiaryPhone) {
        alert("This event does not have a beneficiary Mpesa number set up for receiving gifts.");
        return;
    }

    setIsSubmittingGift(true);
    setMpesaStatus('pending');
    setMpesaMessage('Initiating Mpesa STK Push...');

    try {
        const response = await fetch('/api/mpesa/stkpush', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Number(amount),
                phone: phone,
                eventId: id,
                collectionName: collectionName,
                eventOwnerId: event.ownerId, // Now safe
                contributorName: name,
                beneficiaryPhone: event.beneficiaryPhone, // Now safe
            }),
        });

        const data = await response.json();

        if (response.ok) {
            setMpesaStatus('success');
            setMpesaMessage('Mpesa STK Push sent! Please enter your Mpesa PIN on your phone.');
        } else {
            setMpesaStatus('failed');
            setMpesaMessage(data.message || 'Failed to initiate Mpesa STK Push.');
        }

    } catch (error) {
        console.error("Error during STK Push API call:", error);
        setMpesaStatus('failed');
        setMpesaMessage('Network error or server issue. Please try again.');
    } finally {
        setIsSubmittingGift(false);
    }
  };

  const resetMpesaFlow = () => {
    setAmount(0);
    setPhone("");
    setMpesaStatus('idle');
    setMpesaMessage(null);
    setDialogOpen(false);
  };

  const uploadFiles = async (files: FileList | File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fileRef = ref(storage, `${folder}/${uuid4()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      urls.push(url);
    }
    return urls;
  };

  const handleUploadMoreMedia = async () => {
    // event is guaranteed non-null here due to the main render guard
    if (!user || user.uid !== event.ownerId) { // Now safe
      alert("You are not authorized to upload media for this event.");
      return;
    }

    if (!newImages && !newVideos) {
      setUploadMediaMessage("Please select at least one image or video to upload.");
      return;
    }

    setIsUploadingMedia(true);
    setUploadMediaMessage("Uploading media...");

    try {
      const imageUrls = newImages ? await uploadFiles(newImages, "images") : [];
      const videoUrls = newVideos ? await uploadFiles(newVideos, "videos") : [];

      const eventRef = doc(db, collectionName, id);
      await updateDoc(eventRef, {
        images: arrayUnion(...imageUrls),
        videos: arrayUnion(...videoUrls),
      });

      setUploadMediaMessage("Media uploaded successfully! Page will refresh to show new content.");
      setNewImages(null);
      setNewVideos(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Error uploading new media:", error);
      setUploadMediaMessage(`Failed to upload media: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to send messages.");
      return;
    }

    let messageType: CommunityMessage['type'] = 'text';
    let uploadedMediaUrl: string | null = null;
    let uploadedFileName: string | null = null;
    let messageContent: string | null = null;

    setIsSendingChatMedia(true);

    try {
        if (selectedChatImage) {
            messageType = 'image';
            const uploadedUrls = await uploadFiles([selectedChatImage], 'chat_images');
            if (uploadedUrls.length > 0) {
                uploadedMediaUrl = uploadedUrls[0];
                uploadedFileName = selectedChatImage.name;
            } else {
                throw new Error("Image upload failed or returned no URL.");
            }
            if (chatMessage.trim() !== '') {
                messageContent = chatMessage.trim();
            }
        } else if (selectedChatVideo) {
            messageType = 'video';
            const uploadedUrls = await uploadFiles([selectedChatVideo], 'chat_videos');
            if (uploadedUrls.length > 0) {
                uploadedMediaUrl = uploadedUrls[0];
                uploadedFileName = selectedChatVideo.name;
            } else {
                throw new Error("Video upload failed or returned no URL.");
            }
            if (chatMessage.trim() !== '') {
                messageContent = chatMessage.trim();
            }
        } else if (chatMessage.trim() !== '') {
            messageType = 'text';
            messageContent = chatMessage.trim();
        } else {
            alert("Please enter a message or select an image/video to send.");
            return;
        }

        const chatRef = collection(db, collectionName, id, "community_messages");

        const messagePayload: { [key: string]: any } = {
            senderId: user.uid,
            senderDisplayName: user.displayName || "Anonymous",
            timestamp: Timestamp.now(),
            type: messageType,
            likes: [],
        };

        if (user.photoURL) {
            messagePayload.senderPhotoURL = user.photoURL;
        }
        if (messageContent !== null) {
            messagePayload.content = messageContent;
        }
        if (uploadedMediaUrl !== null) {
            messagePayload.mediaUrl = uploadedMediaUrl;
        }
        if (uploadedFileName !== null) {
            messagePayload.fileName = uploadedFileName;
        }

        await addDoc(chatRef, messagePayload);

        setChatMessage('');
        setSelectedChatImage(null);
        setSelectedChatVideo(null);
        const chatImageUploadInput = document.getElementById('chatImageUpload') as HTMLInputElement;
        if (chatImageUploadInput) chatImageUploadInput.value = '';
        const chatVideoUploadInput = document.getElementById('chatVideoUpload') as HTMLInputElement;
        if (chatVideoUploadInput) chatVideoUploadInput.value = '';

    } catch (error) {
        console.error("Error sending message:", error);
        alert(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsSendingChatMedia(false);
    }
  };

  const handleChatImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedChatImage(e.target.files[0]);
      setSelectedChatVideo(null);
      setChatMessage('');
      (document.getElementById('chatVideoUpload') as HTMLInputElement).value = '';
    } else {
      setSelectedChatImage(null);
    }
  };

  const handleChatVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedChatVideo(e.target.files[0]);
      setSelectedChatImage(null);
      setChatMessage('');
      (document.getElementById('chatImageUpload') as HTMLInputElement).value = '';
    } else {
      setSelectedChatVideo(null);
    }
  };

  const handleToggleLike = async (message: CommunityMessage) => {
    if (!user) {
      alert("Please sign in to like messages.");
      return;
    }

    const messageRef = doc(db, collectionName, id, "community_messages", message.id);
    const hasLiked = message.likes?.includes(user.uid);

    try {
      await updateDoc(messageRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("Failed to update like status.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) {
      alert("Please sign in to delete messages.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
        return;
    }

    setDeletingMessageId(messageId);

    try {
      const messageRef = doc(db, collectionName, id, "community_messages", messageId);
      await deleteDoc(messageRef);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert(`Failed to delete message. Check your permissions. Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setDeletingMessageId(null);
    }
  };

  const getShareText = useCallback(() => {
    // Ensure event is not null before accessing its properties
    if (!event) return ''; // Fallback for safety, though render guard prevents this
    const eventUrl = `${window.location.origin}/events/${collectionName}/${id}`;
    return `Join the '${event.title}' event on Mshikaki Events! Learn more and contribute here: ${eventUrl}`;
  }, [event, collectionName, id]);

  const getTwitterShareUrl = useCallback(() => {
    if (!event) return '';
    const text = encodeURIComponent(`Join the '${event.title}' event on Mshikaki Events!`);
    const url = encodeURIComponent(`${window.location.origin}/events/${collectionName}/${id}`);
    const hashtags = encodeURIComponent('MshikakiEvents,EventCommunity,Fundraising');
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`;
  }, [event, collectionName, id]);

  const getFacebookShareUrl = useCallback(() => {
    if (!event) return '';
    const url = encodeURIComponent(`${window.location.origin}/events/${collectionName}/${id}`);
    return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  }, [collectionName, id, event]);

  const getWhatsAppShareUrl = useCallback(() => {
    if (!event) return '';
    const text = encodeURIComponent(`Join the '${event.title}' event on Mshikaki Events! Click the link: ${window.location.origin}/events/${collectionName}/${id}`);
    return `https://api.whatsapp.com/send?text=${text}`;
  }, [event, collectionName, id]);

  const handleNativeShare = useCallback(async () => {
    if (!event) return; // Ensure event is not null
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Join the '${event.title}' event community on Mshikaki Events!`,
          url: `${window.location.origin}/events/${collectionName}/${id}`,
        });
        console.log('Event shared successfully!');
      } catch (error) {
        console.error('Error sharing event:', error);
      }
    } else {
      alert("Your browser does not support the native share dialog. Please use the social media buttons below.");
    }
  }, [event, collectionName, id]);


  if (loading) return <p className="p-6 text-center text-gray-500">Loading event details...</p>;
  // This guard ensures 'event' is not null for the rest of the render.
  if (!event) return <p className="p-6 text-center text-red-500">Event not found. It might have been deleted or the URL is incorrect.</p>;

  const goal = event.goal || 100000;
  const progress = Math.min((contributionsTotal / goal) * 100, 100);
  const isOwner = user?.uid === event.ownerId;


  const featuredMediaUrl = event.images && event.images.length > 0 ? event.images[0] :
                           (event.videos && event.videos.length > 0 ? event.videos[0] : null);
  const featuredMediaType = featuredMediaUrl === event.images?.[0] ? 'image' : 'video';


  return (
    <div className="bg-gradient-to-br from-rose-50 to-pink-100 min-h-screen p-6">
      <main className="max-w-4xl mx-auto space-y-8 p-6 bg-white shadow-2xl rounded-3xl border border-rose-100">

        {/* Go Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-semibold text-base transition-colors py-2 px-4 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50 hover:bg-rose-100"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Go Back
        </button>

        {/* Event Header Section */}
        <section className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-rose-800 leading-tight">
            {event.title}
          </h1>
          <p className="text-lg text-gray-700 flex items-center justify-center gap-2">
            <MapPinIcon className="w-5 h-5 text-rose-600" />
            <span>{event.location}</span>
          </p>
          {event.date && (
            <p className="text-lg text-gray-700 flex items-center justify-center gap-2">
              <CalendarIcon className="w-5 h-5 text-rose-600" />
              <span>{event.date}</span>
            </p>
          )}
        </section>

        {/* Featured Media (Largest Image/Video) */}
        {featuredMediaUrl && (
            <section className="w-full h-[500px] md:h-[600px] relative rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                {featuredMediaType === 'image' ? (
                    <Image
                        src={featuredMediaUrl}
                        alt={`Featured event image for ${event.title}`}
                        fill
                        priority
                        className="object-contain bg-gray-900"
                        sizes="100vw"
                    />
                ) : (
                    <video
                        src={featuredMediaUrl}
                        controls
                        className="w-full h-full object-contain"
                        aria-label={`Featured event video for ${event.title}`}
                        preload="metadata"
                    >
                        Your browser does not support the video tag.
                    </video>
                )}
                {featuredMediaType === 'video' && (
                    <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Featured Video
                    </div>
                )}
            </section>
        )}


        {/* Story Section */}
        {event.story && (
          <section className="bg-rose-50 shadow-inner p-6 rounded-2xl border border-rose-200 text-gray-800">
            <h2 className="text-2xl font-bold text-rose-700 mb-3">Our Story</h2>
            <p className="whitespace-pre-line leading-relaxed">{event.story}</p>
          </section>
        )}

        {/* Share Event Section */}
        <section className="bg-purple-50 shadow-inner p-6 rounded-2xl border border-purple-200 space-y-4">
            <Collapsible open={showShareOptions} onOpenChange={setShowShareOptions}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-purple-800 font-bold text-lg">
                        <Share2Icon className="w-6 h-6 text-purple-700" />
                        Share This Event
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-purple-700 hover:text-purple-900">
                            <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showShareOptions ? "rotate-180" : ""}`} />
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-4 space-y-4">
                    <p className="text-gray-700 text-sm">Help spread the word about this event!</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                        {/* Native Share (if supported by browser) */}
                        {navigator.share && (
                            <Button onClick={handleNativeShare} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm flex items-center gap-2">
                                <Share2Icon className="w-4 h-4" /> Share
                            </Button>
                        )}
                        {/* Twitter */}
                        <a href={getTwitterShareUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white rounded-full px-4 py-2 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.13l-6.177-8.156-6.436 8.156H2.809l7.47-8.542L2.25 2.25h3.308l5.593 6.425L18.244 2.25zM17.292 20l-1.157-1.47L4.72 4h2.417l10.322 13.99L17.292 20z"></path></svg>
                            Twitter
                        </a>
                        {/* Facebook */}
                        <a href={getFacebookShareUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-full px-4 py-2 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.505 1.492-3.89 3.776-3.89 1.094 0 2.24.195 2.24.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.891h-2.33v6.988C18.343 21.128 22 16.991 22 12z"></path></svg>
                            Facebook
                        </a>
                        {/* WhatsApp */}
                        <a href={getWhatsAppShareUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-full px-4 py-2 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.582 2 2 6.582 2 12.041c0 2.016.597 3.916 1.63 5.568L2 22l4.63-1.63a9.92 9.92 0 005.41 1.67h.001c5.459 0 9.92-4.558 9.92-10.001S17.5 2 12.04 2zM17 15.696c-.22 0-.38-.073-.59-.146-.4-.146-1.573-.623-1.812-.662-.23-.04-.4-.04-.56.073-.16.11-.6.662-.78.8-.19.146-.37.146-.6.073-.22-.073-.91-.323-1.74-.91-.64-.439-1.07-1.07-1.2-.8-.11.147.01.277.15.46.12.146.22.287.3.43.07.146.04.287-.07.4-.11.147-.73.69-.84.77-.11.11-.23.146-.4.146-.17 0-.35-.073-.5-.183-.15-.11-.4-.25-.83-.49-.44-.219-1.03-.8-1.56-1.46-.53-.662-.84-1.284-.66-1.628.18-.344.38-.623.5-.732.12-.11.23-.22.3-.293.07-.073.14-.146.19-.22.04-.11.02-.219-.01-.328-.04-.073-.3-.7-.4-.95-.12-.219-.24-.292-.4-.365-.16-.073-.34-.146-.51-.146-.17 0-.44.073-.66.219-.22.146-.84.8-.84 1.936 0 1.137.86 2.23 1.07 2.376.21.146 1.63 2.47 3.86 3.447 2.23.977 2.23.69 2.65.662.42-.04.91-.183 1.04-.292.12-.11.23-.25.35-.4.11-.146.23-.287.35-.44a.434.434 0 00.08-.13c.12-.146.12-.25.07-.4z"></path></svg>
                            WhatsApp
                        </a>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </section>


        {/* Contribution Note (Collapsible) */}
        {event.contributionNote && (
          <Collapsible open={showNote} onOpenChange={setShowNote} className="bg-yellow-50 border border-yellow-300 rounded-2xl p-5 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-yellow-800 font-bold text-lg">
                <InfoIcon className="w-6 h-6 text-yellow-700" />
                Why Support This Event?
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="text-yellow-700 hover:text-yellow-900">
                  <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showNote ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="text-base text-gray-700 whitespace-pre-line mt-1 leading-relaxed">
              {event.contributionNote}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Progress Bar & Gift Button Section */}
        <section className="space-y-4 text-center p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-rose-700">Progress Towards Goal</h2>
          <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end px-2"
              style={{ width: `${progress}%` }}
            >
              <span className="text-xs font-bold text-white drop-shadow-sm">
                {progress.toFixed(0)}%
              </span>
            </div>
          </div>
          <p className="text-lg font-semibold text-gray-700">
            KES {contributionsTotal.toLocaleString()} raised of KES {goal.toLocaleString()}
          </p>

          {/* Contribute Modal Trigger Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 bg-rose-600 hover:bg-rose-700 px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105">
                🎁 Send Gift
              </Button>
            </DialogTrigger>
            <DialogContent className="space-y-5 max-w-sm w-full mx-auto p-7 rounded-3xl shadow-xl z-50 bg-white border-rose-200">
              <DialogTitle className="text-center text-rose-700 font-extrabold text-2xl">
                🎁 Send Your Gift
              </DialogTitle>

              {/* MPESA STATUS FEEDBACK */}
              {mpesaStatus !== 'idle' && (
                <div className={`p-4 rounded-lg text-base text-center font-medium
                  ${mpesaStatus === 'pending' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
                  ${mpesaStatus === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : ''}
                  ${mpesaStatus === 'failed' ? 'bg-red-100 text-red-800 border border-red-200' : ''}`
                }>
                  {mpesaMessage}
                </div>
              )}

              {/* Gift form - hidden if Mpesa process is successful and awaiting callback */}
              {mpesaStatus !== 'success' && (
                <>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    disabled={isSubmittingGift}
                    className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                  />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone (e.g., 0712345678)"
                    disabled={isSubmittingGift}
                    className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                  />
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="KES"
                    min="1"
                    disabled={isSubmittingGift}
                    className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                  />

                  <Button onClick={handleContribute} className="w-full bg-rose-600 hover:bg-rose-700 py-3 text-lg font-semibold rounded-lg shadow-md" disabled={isSubmittingGift}>
                    {isSubmittingGift ? "Sending..." : "Submit Gift"}
                  </Button>
                </>
              )}

              {/* Dialog Footer for closing */}
              {(mpesaStatus === 'success' || mpesaStatus === 'failed') && (
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={resetMpesaFlow} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg">
                    Close
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </section>

        {/* Add More Media Section (Only for Owner) */}
        {isOwner && (
            <section className="bg-blue-50 shadow-inner p-6 rounded-2xl border border-blue-200 space-y-4">
                <h2 className="text-2xl font-bold text-blue-700 mb-3 flex items-center gap-2">
                    <UploadCloudIcon className="w-6 h-6" /> Add More Photos & Videos
                </h2>

                <div className="space-y-3">
                    <div>
                        <label htmlFor="newImagesUpload" className="block text-gray-700 font-medium mb-1 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-blue-600" /> Select New Images
                        </label>
                        <input
                            id="newImagesUpload"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => setNewImages(e.target.files)}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-100 file:text-blue-700
                                hover:file:bg-blue-200"
                            disabled={isUploadingMedia}
                        />
                    </div>
                    <div>
                        <label htmlFor="newVideosUpload" className="block text-gray-700 font-medium mb-1 flex items-center gap-2">
                            <VideoIcon className="w-5 h-5 text-blue-600" /> Select New Videos
                        </label>
                        <input
                            id="newVideosUpload"
                            type="file"
                            accept="video/*"
                            multiple
                            onChange={(e) => setNewVideos(e.target.files)}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-100 file:text-blue-700
                                hover:file:bg-blue-200"
                            disabled={isUploadingMedia}
                        />
                    </div>
                </div>

                {uploadMediaMessage && (
                    <p className="text-sm text-center font-medium
                        p-2 rounded-lg
                        bg-yellow-100 text-yellow-800 border border-yellow-200">
                        {uploadMediaMessage}
                    </p>
                )}

                <Button
                    onClick={handleUploadMoreMedia}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold rounded-lg shadow-md flex items-center justify-center gap-2"
                    disabled={isUploadingMedia || (!newImages && !newVideos)}
                >
                    {isUploadingMedia ? (
                        <>
                            <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
                            </svg>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <UploadCloudIcon className="w-5 h-5" />
                            Upload Media
                        </>
                    )}
                </Button>
            </section>
        )}

        {/* Media Gallery Section (All other Images and Videos) */}
        {((event.images && event.images.length > (featuredMediaUrl === event.images?.[0] ? 1 : 0)) || (event.videos && event.videos.length > (featuredMediaUrl === event.videos?.[0] ? 1 : 0))) && (
          <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-rose-700 mb-5">More Photos & Videos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Display Images (excluding the featured one if it's an image) */}
              {(event.images || [])
                .filter(url => !(featuredMediaType === 'image' && url === featuredMediaUrl))
                .map((url, index) => (
                <div key={`img-gallery-${index}`} className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md border border-gray-200">
                  <Image
                    src={url}
                    alt={`Event Image ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ))}
              {/* Display Videos (excluding the featured one if it's a video) */}
              {(event.videos || [])
                .filter(url => !(featuredMediaType === 'video' && url === featuredMediaUrl))
                .map((url, index) => (
                <div key={`video-gallery-${index}`} className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md border border-gray-200 bg-black flex items-center justify-center">
                  <video
                    src={url}
                    controls
                    className="w-full h-full object-contain"
                    aria-label={`Event Video ${index + 1}`}
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Community Participants Section */}
        <section className="bg-emerald-50 shadow-inner p-6 rounded-2xl border border-emerald-200 space-y-4">
            <Collapsible open={showParticipants} onOpenChange={setShowParticipants}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-lg">
                        <UsersIcon className="w-6 h-6 text-emerald-700" />
                        Community Participants ({communityParticipants.length})
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-emerald-700 hover:text-emerald-900">
                            <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showParticipants ? "rotate-180" : ""}`} />
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-4">
                    {communityParticipants.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-4">No participants in this community yet.</p>
                    ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {communityParticipants.map(participant => (
                                <li key={participant.uid} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <Image
                                        src={participant.photoURL || '/default-avatar.png'}
                                        alt={participant.displayName}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover border-2 border-emerald-400"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-800">
                                            {participant.displayName}
                                        </span>
                                        {participant.isOwner && (
                                            <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-semibold mt-1 self-start">
                                                Event Owner
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </section>


        {/* Contribution List Section */}
        <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-rose-700 mb-4">🎁 Contributions</h2>
          <ul className="space-y-3">
            {contributionList.length === 0 ? (
              <p className="text-gray-500 italic text-center py-4">No contributions yet. Be the first to send a gift!</p>
            ) : (
              contributionList.map((c) => (
                <li key={c.id} className="text-base text-gray-700 flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-100">
                  <span className="font-medium text-gray-800">{c.name || "Anonymous"}</span>
                  <span className="text-gray-600 ml-2">({maskPhone(c.phone || "")})</span>
                  <span className="font-semibold text-rose-600 ml-auto">KES {c.amount?.toLocaleString()}</span>
                  {c.status && (
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold
                      ${c.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
                      ${c.status === 'PENDING' ? 'bg-blue-100 text-blue-800' : ''}
                      ${c.status === 'FAILED' || c.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}`
                    }>
                      {c.status}
                    </span>
                  )}
                  {c.mpesaReceiptNumber && (
                    <span className="ml-2 text-xs text-gray-500">Ref: {c.mpesaReceiptNumber}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Event Community Chat Section */}
        <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center gap-3">
                <MessageCircleIcon className="w-7 h-7 text-purple-600" /> Event Community Chat
            </h2>

            {/* Chat Messages Display Area */}
            <div className="h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 custom-scrollbar">
                {chatMessages.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-8">
                        No messages yet. Be the first to start a conversation!
                    </p>
                ) : (
                    chatMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-start gap-3 mb-4 ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.senderId !== user?.uid && (
                                <Image
                                    src={msg.senderPhotoURL || '/default-avatar.png'}
                                    alt={msg.senderDisplayName}
                                    width={32}
                                    height={32}
                                    className="rounded-full object-cover border-2 border-gray-300"
                                />
                            )}
                            <div className={`flex flex-col max-w-[75%] p-3 rounded-xl shadow-sm relative group ${
                                msg.senderId === user?.uid
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                            }`}>
                                <span className={`text-xs font-bold mb-1 ${msg.senderId === user?.uid ? 'text-purple-100' : 'text-gray-600'}`}>
                                    {msg.senderDisplayName} {msg.senderId === event.ownerId && <span className="text-xs bg-yellow-400 text-yellow-900 px-1 rounded-full font-semibold">ADMIN</span>}
                                </span>
                                {/* Render content based on message type */}
                                {msg.type === 'text' && msg.content && (
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                )}
                                {msg.type === 'image' && msg.mediaUrl && (
                                    <div className="relative w-48 h-32 md:w-64 md:h-48 rounded-lg overflow-hidden border border-gray-300 mb-1">
                                        <Image
                                            src={msg.mediaUrl}
                                            alt="Shared image"
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                        />
                                    </div>
                                )}
                                {msg.type === 'video' && msg.mediaUrl && (
                                    <div className="relative w-48 h-32 md:w-64 md:h-48 rounded-lg overflow-hidden border border-gray-300 mb-1 bg-black flex items-center justify-center">
                                        <video
                                            src={msg.mediaUrl}
                                            controls
                                            className="w-full h-full object-contain"
                                            aria-label="Shared video"
                                            preload="metadata"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                )}
                                {/* Likes & Delete Controls */}
                                {user && (
                                    <div className={`flex items-center gap-2 mt-2 ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                                        {/* Like Button */}
                                        <button
                                            onClick={() => handleToggleLike(msg)}
                                            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                                                msg.likes?.includes(user.uid)
                                                    ? 'bg-red-500 text-white'
                                                    : msg.senderId === user?.uid
                                                        ? 'bg-purple-500/30 text-purple-100 hover:bg-purple-500/50'
                                                        : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                                            }`}
                                            title={msg.likes?.includes(user.uid) ? 'Unlike' : 'Like'}
                                        >
                                            <HeartIcon className={`w-3 h-3 ${msg.likes?.includes(user.uid) ? 'fill-current' : ''}`} />
                                            <span>{msg.likes?.length || 0}</span>
                                        </button>

                                        {/* Delete Button (Visible to sender or event owner) */}
                                        {(msg.senderId === user?.uid || isOwner) && (
                                            <button
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                className={`ml-auto p-1 rounded-full transition-colors ${
                                                    msg.senderId === user?.uid
                                                        ? 'text-purple-100 hover:bg-purple-500/50'
                                                        : 'text-red-500 hover:bg-red-100'
                                                } ${deletingMessageId === msg.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={deletingMessageId === msg.id}
                                                title="Delete Message"
                                            >
                                                {deletingMessageId === msg.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2Icon className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <span className={`text-xs mt-1 ${msg.senderId === user?.uid ? 'text-purple-200' : 'text-gray-500'} text-right`}>
                                    {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {msg.senderId === user?.uid && (
                                <Image
                                    src={user?.photoURL || '/default-avatar.png'}
                                    alt={user?.displayName || 'You'}
                                    width={32}
                                    height={32}
                                    className="rounded-full object-cover border-2 border-purple-400"
                                />
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Area */}
            {user ? (
                <form onSubmit={handleSendMessage} className="flex flex-col gap-2 p-2 bg-gray-100 rounded-lg border border-gray-200">
                    {/* Display selected file names */}
                    {(selectedChatImage || selectedChatVideo) && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            {selectedChatImage && (
                                <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    <ImageIcon className="w-4 h-4" /> {selectedChatImage.name}
                                    <button type="button" onClick={() => setSelectedChatImage(null)} className="ml-1 text-blue-600 hover:text-blue-900 font-bold">x</button>
                                </span>
                            )}
                            {selectedChatVideo && (
                                <span className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    <VideoIcon className="w-4 h-4" /> {selectedChatVideo.name}
                                    <button type="button" onClick={() => setSelectedChatVideo(null)} className="ml-1 text-green-600 hover:text-green-900 font-bold">x</button>
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2 items-center">
                        <Input
                            type="text"
                            value={chatMessage}
                            onChange={(e) => {
                                setChatMessage(e.target.value);
                                setSelectedChatImage(null);
                                setSelectedChatVideo(null);
                                const chatImageUploadInput = document.getElementById('chatImageUpload') as HTMLInputElement;
                                if (chatImageUploadInput) chatImageUploadInput.value = '';
                                const chatVideoUploadInput = document.getElementById('chatVideoUpload') as HTMLInputElement;
                                if (chatVideoUploadInput) chatVideoUploadInput.value = '';
                            }}
                            placeholder="Type your message..."
                            className="flex-grow border-gray-300 focus:border-purple-500 focus:ring-purple-500 rounded-full py-2 px-4"
                            disabled={isSendingChatMedia || !!selectedChatImage || !!selectedChatVideo}
                        />
                        {/* Image Upload Button */}
                        <label htmlFor="chatImageUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
                            <ImageIcon className="w-5 h-5" />
                            <input
                                id="chatImageUpload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleChatImageChange}
                                disabled={isSendingChatMedia || !!selectedChatVideo || chatMessage.trim() !== ''}
                            />
                        </label>
                        {/* Video Upload Button */}
                        <label htmlFor="chatVideoUpload" className="cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-200 p-2 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10 flex-shrink-0">
                            <VideoIcon className="w-5 h-5" />
                            <input
                                id="chatVideoUpload"
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={handleChatVideoChange}
                                disabled={isSendingChatMedia || !!selectedChatImage || chatMessage.trim() !== ''}
                            />
                        </label>
                        <Button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-md transition-colors flex-shrink-0"
                            disabled={isSendingChatMedia || (chatMessage.trim() === '' && !selectedChatImage && !selectedChatVideo)}
                        >
                            {isSendingChatMedia ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
                                </svg>
                            ) : (
                                <SendIcon className="w-5 h-5" />
                            )}
                        </Button>
                    </div>
                </form>
            ) : (
                <p className="text-center text-gray-500 italic py-4">
                    Sign in to join the conversation and send messages!
                </p>
            )}
        </section>

      </main>
    </div>
  );
}
