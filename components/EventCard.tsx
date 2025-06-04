// components/EventCard.tsx
import React from "react";
import Image from "next/image";
import { deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth"; // Ensure you have an auth hook or context

// Props definition
interface EventCardProps {
  title: string;
  location: string;
  imageUrl: string;
  eventId: string;
  mediaUrls: string[];
  onViewEvent: () => void;
  bottomAction?: React.ReactNode;
  ownerId: string;
}

export default function EventCard({
  title,
  location,
  imageUrl,
  eventId,
  mediaUrls,
  onViewEvent,
  bottomAction,
  ownerId,
}: EventCardProps) {
  const { user } = useAuth();

  const handleDeleteEvent = async () => {
    try {
      for (const url of mediaUrls) {
        const decodedUrl = decodeURIComponent(url.split('?')[0]);
        const pathStart = decodedUrl.indexOf("/o/") + 3;
        const pathEnd = decodedUrl.indexOf("?alt=") === -1 ? decodedUrl.length : decodedUrl.indexOf("?alt=");
        const filePath = decodedUrl.substring(pathStart, pathEnd).replace(/%2F/g, "/");

        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
      }

      await deleteDoc(doc(db, "weddings", eventId)); // Adjust collection name as needed
      alert("Event deleted successfully ✅");
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event ❌");
    }
  };

  const isOwner = user?.uid === ownerId;

  return (
    <div className="rounded-2xl shadow-md overflow-hidden bg-white hover:scale-105 transition-transform">
      <Image
        src={imageUrl}
        alt={title}
        width={400}
        height={250}
        className="w-full h-48 object-cover"
      />
      <div className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-500">{location}</p>

        <div className="space-y-2">
          <button
            onClick={onViewEvent}
            className="w-full px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800"
          >
            👀 View Event
          </button>

          {/* ✅ Optional Delete Button */}
          {isOwner && (
            <button
              onClick={handleDeleteEvent}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700"
            >
              🗑️ Delete
            </button>
          )}

          {/* ✅ Optional bottomAction */}
          {bottomAction && (
            <div className="w-full">
              {bottomAction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
