// components/event-sections/EventCommunityChatSection.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircleIcon,
  SendIcon,
  HeartIcon,
  Trash2Icon,
  Loader2,
  ImageIcon,
  VideoIcon
} from "lucide-react";
import {
  Timestamp,
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { db, storage } from "@/lib/firebase";

// Interfaces for props received from EventDetailPage
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

interface CurrentUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
}

interface EventCommunityChatSectionProps {
  eventId: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
  eventData: EventData; // Full event data passed as prop
  currentUser: CurrentUser | null; // Authenticated user data
  chatMessages: CommunityMessage[]; // Data passed from parent
}

export default function EventCommunityChatSection({
  eventId,
  collectionName,
  eventData,
  currentUser,
  chatMessages,
}: EventCommunityChatSectionProps) {
  const [chatMessage, setChatMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedChatImage, setSelectedChatImage] = useState<File | null>(null);
  const [selectedChatVideo, setSelectedChatVideo] = useState<File | null>(null);
  const [isSendingChatMedia, setIsSendingChatMedia] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const isOwner = currentUser?.uid === eventData.ownerId;

  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (chatContainer) {
        const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 100;
        if (isScrolledToBottom || (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].senderId === currentUser?.uid)) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }
  }, [chatMessages, currentUser?.uid]);

  // Generic function to upload files to Firebase Storage (copied from media section as chat needs it)
  const uploadFiles = async (files: FileList | File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fileRef = ref(storage, `${folder}/${uuidv4()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      urls.push(url);
    }
    return urls;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
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

        const chatRef = collection(db, collectionName, eventId, "community_messages");

        const messagePayload: { [key: string]: any } = {
            senderId: currentUser.uid,
            senderDisplayName: currentUser.displayName || "Anonymous",
            timestamp: Timestamp.now(),
            type: messageType,
            likes: [],
        };

        if (currentUser.photoURL) {
            messagePayload.senderPhotoURL = currentUser.photoURL;
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
    if (!currentUser) {
      alert("Please sign in to like messages.");
      return;
    }

    const messageRef = doc(db, collectionName, eventId, "community_messages", message.id);
    const hasLiked = message.likes?.includes(currentUser.uid);

    try {
      await updateDoc(messageRef, {
        likes: hasLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("Failed to update like status.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) {
      alert("Please sign in to delete messages.");
      return;
    }
    // Using window.confirm for now, consider a custom dialog for better UX
    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
        return;
    }

    setDeletingMessageId(messageId);

    try {
      const messageRef = doc(db, collectionName, eventId, "community_messages", messageId);
      await deleteDoc(messageRef);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert(`Failed to delete message. Check your permissions. Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setDeletingMessageId(null);
    }
  };


  return (
    <> {/* Added React.Fragment as a top-level wrapper */}
      <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center gap-3">
            <MessageCircleIcon className="w-7 h-7 text-purple-600" /> Community Chat
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
                        className={`flex items-start gap-3 mb-4 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.senderId !== currentUser?.uid && (
                            <Image
                                src={msg.senderPhotoURL || '/default-avatar.png'}
                                alt={msg.senderDisplayName}
                                width={32}
                                height={32}
                                className="rounded-full object-cover border-2 border-gray-300"
                            />
                        )}
                        <div className={`flex flex-col max-w-[75%] p-3 rounded-xl shadow-sm relative group ${
                            msg.senderId === currentUser?.uid
                                ? 'bg-purple-600 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-800 rounded-bl-none'
                        }`}>
                            <span className={`text-xs font-bold mb-1 ${msg.senderId === currentUser?.uid ? 'text-purple-100' : 'text-gray-600'}`}>
                                {msg.senderDisplayName} {msg.senderId === eventData.ownerId && <span className="text-xs bg-yellow-400 text-yellow-900 px-1 rounded-full font-semibold">ADMIN</span>}
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
                            {currentUser && (
                                <div className={`flex items-center gap-2 mt-2 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                                    {/* Like Button */}
                                    <button
                                        onClick={() => handleToggleLike(msg)}
                                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                                            msg.likes?.includes(currentUser.uid)
                                                ? 'bg-red-500 text-white'
                                                : msg.senderId === currentUser?.uid
                                                    ? 'bg-purple-500/30 text-purple-100 hover:bg-purple-500/50'
                                                    : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                                        }`}
                                        title={msg.likes?.includes(currentUser.uid) ? 'Unlike' : 'Like'}
                                    >
                                        <HeartIcon className={`w-3 h-3 ${msg.likes?.includes(currentUser.uid) ? 'fill-current' : ''}`} />
                                        <span>{msg.likes?.length || 0}</span>
                                    </button>

                                    {/* Delete Button (Visible to sender or event owner) */}
                                    {(msg.senderId === currentUser?.uid || isOwner) && (
                                        <button
                                            onClick={() => handleDeleteMessage(msg.id)}
                                            className={`ml-auto p-1 rounded-full transition-colors ${
                                                msg.senderId === currentUser?.uid
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
                            <span className={`text-xs mt-1 ${msg.senderId === currentUser?.uid ? 'text-purple-200' : 'text-gray-500'} text-right`}>
                                {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area */}
        {currentUser ? (
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
    </> // Closing React.Fragment
  );
}
