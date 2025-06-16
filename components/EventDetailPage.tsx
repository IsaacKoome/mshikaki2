// components/EventDetailPage.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy, // Keep orderBy for chat messages
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Only import db here, storage is for media section
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowLeftIcon,
  ImageIcon,
  MessageCircleIcon,
  UsersIcon,
  DollarSignIcon // For Contributions
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth"; // Keep useAuth for global user state

// Import the new section components
import EventMediaSection from "@/components/event-sections/EventMediaSection";
import EventContributionsSection from "@/components/event-sections/EventContributionsSection";
import EventCommunityChatSection from "@/components/event-sections/EventCommunityChatSection";
import EventCommunityMembersSection from "@/components/event-sections/EventCommunityMembersSection";

// Interfaces (These define the shapes of data that will be passed down)
// Keep them here as they are foundational for EventDetailPage's state and props for children
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

// Props for EventDetailPage itself
interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

// Interfaces (Update this EventData interface)
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
  ownerId?: string; // Made optional if you don't strictly require it on all read operations
  // New fields for Phase 2:
  eventCategory: 'wedding' | 'birthday' | 'babyshower' | 'party' | 'concert' | 'community' | 'church' | 'fundraiser' | 'other';
  isPublic: boolean;
  [key: string]: any; // Keep this for flexibility if other fields are present
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

export default function EventDetailPage({ id, collectionName }: Props) {
  const { user } = useAuth(); // Global auth state for the current user
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'photos-videos'; // Default to 'photos-videos'

  // States for data that will be passed down to sections
  const [contributionsTotal, setContributionsTotal] = useState(0);
  const [contributionList, setContributionList] = useState<Contribution[]>([]);
  const [chatMessages, setChatMessages] = useState<CommunityMessage[]>([]);
  const [communityParticipants, setCommunityParticipants] = useState<Participant[]>([]);


  // Effect 1: Fetch Event Data (runs once or when id/collectionName changes)
  useEffect(() => {
    const fetchEventData = async () => {
      const eventRef = doc(db, collectionName, id);
      try {
        const snapshot = await getDoc(eventRef);
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
  }, [id, collectionName]);

  // Effect 2: Fetch Contributions, Chat Messages, and Participants (runs when event data is available)
  useEffect(() => {
    if (!event) return; // Guard: Do not proceed if event data is not yet loaded

    // --- Contributions Listener ---
    const qContributions = query(collection(db, "contributions"), where("eventId", "==", id));
    const unsubContributions = onSnapshot(qContributions, (snapshot) => {
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
    }, (error) => {
      console.error("Error fetching contributions:", error);
    });

    // --- Chat Messages and Participants Listener ---
    const chatRef = collection(db, collectionName, id, "community_messages");
    const qChat = query(chatRef, orderBy("timestamp", "asc"));

    const unsubChatAndParticipants = onSnapshot(qChat, async (snapshot) => {
      const messages = snapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
      })) as CommunityMessage[];
      setChatMessages(messages);

      // Derive participants from chat messages
      const uniqueSenderIds = new Set<string>();
      messages.forEach(msg => uniqueSenderIds.add(msg.senderId));

      const newParticipants: Participant[] = [];
      if (event.ownerId) { // Event owner is always a participant
        newParticipants.push({
          uid: event.ownerId,
          displayName: event.ownerId === user?.uid ? user.displayName || "You (Event Owner)" : "Event Owner",
          photoURL: event.ownerId === user?.uid ? user.photoURL || '/default-avatar.png' : '/default-avatar.png',
          isOwner: true,
        });
        uniqueSenderIds.delete(event.ownerId); // Remove owner from set to avoid duplication
      }

      // Fetch user data for other chat participants
      for (const senderId of Array.from(uniqueSenderIds)) {
          if (senderId === user?.uid && user?.displayName) { // Current user's info from auth context
              newParticipants.push({
                  uid: user.uid,
                  displayName: user.displayName,
                  photoURL: user.photoURL || '/default-avatar.png',
                  isOwner: false,
              });
          } else { // Fetch from 'users' collection for others
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
      // Sort participants: owner first, then alphabetically by display name
      newParticipants.sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      setCommunityParticipants(newParticipants);
    }, (error) => {
      console.error("Error fetching chat messages or participants:", error);
    });

    // Cleanup function for listeners
    return () => {
      unsubContributions();
      unsubChatAndParticipants();
    };
  }, [id, collectionName, user?.uid, event]); // Dependencies: user and event for participant logic


  if (loading) return <p className="p-6 text-center text-gray-500">Loading event details...</p>;
  if (!event) return <p className="p-6 text-center text-red-500">Event not found. It might have been deleted or the URL is incorrect.</p>;

  // Props to pass down to child components
  const commonSectionProps = {
    eventId: id,
    collectionName: collectionName,
    eventData: event,
    currentUser: user,
  };

  return (
    <div className="bg-gradient-to-br from-rose-50 to-pink-100 min-h-screen p-6">
      <main className="max-w-4xl mx-auto space-y-8 p-6 bg-white shadow-2xl rounded-3xl border border-rose-100">

        {/* Go Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-semibold text-base transition-colors py-2 px-4 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50 hover:bg-rose-100 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Go Back
        </button>

        {/* Event Header Section (Remains static on all tabs) */}
        <section className="text-center space-y-3 mb-8">
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
          {event.story && (
            <p className="whitespace-pre-line leading-relaxed text-gray-800 mt-4">
                {event.story}
            </p>
          )}
        </section>

        {/* Sticky Tab Navigation Bar */}
        <nav className="sticky top-0 z-10 bg-white bg-opacity-95 backdrop-blur-sm p-3 rounded-xl shadow-md border border-gray-200 flex flex-wrap justify-center gap-3 mb-8">
            <Link
                href={`/events/${collectionName}/${id}?tab=photos-videos`}
                passHref
                className={`flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-2 transition-colors cursor-pointer ${currentTab === 'photos-videos' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <ImageIcon className="w-4 h-4" /> Photos & Videos
            </Link>
            <Link
                href={`/events/${collectionName}/${id}?tab=contributions`}
                passHref
                className={`flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-2 transition-colors cursor-pointer ${currentTab === 'contributions' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <DollarSignIcon className="w-4 h-4" /> Contributions & Gifts
            </Link>
            <Link
                href={`/events/${collectionName}/${id}?tab=chat`}
                passHref
                className={`flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-2 transition-colors cursor-pointer ${currentTab === 'chat' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <MessageCircleIcon className="w-4 h-4" /> Community Chat
            </Link>
            <Link
                href={`/events/${collectionName}/${id}?tab=members`}
                passHref
                className={`flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-2 transition-colors cursor-pointer ${currentTab === 'members' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <UsersIcon className="w-4 h-4" /> Community Members
            </Link>
        </nav>

        {/* Conditional Rendering of Sections */}
        <section className="mt-8">
            {currentTab === 'photos-videos' && <EventMediaSection {...commonSectionProps} />}
            {currentTab === 'contributions' && (
                <EventContributionsSection
                    {...commonSectionProps}
                    contributionsTotal={contributionsTotal}
                    contributionList={contributionList}
                />
            )}
            {currentTab === 'chat' && (
                <EventCommunityChatSection
                    {...commonSectionProps}
                    chatMessages={chatMessages}
                />
            )}
            {currentTab === 'members' && (
                <EventCommunityMembersSection
                    {...commonSectionProps}
                    communityParticipants={communityParticipants}
                />
            )}
        </section>

      </main>
    </div>
  );
}
