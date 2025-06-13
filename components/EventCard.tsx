// components/EventCard.tsx
import React from "react";
import Image from "next/image";
import { deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

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
  eventType: string; // <<< IMPORTANT: ADD THIS PROP
  allowDelete?: boolean; // <<< NEW PROP: Controls delete button visibility
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
  eventType, // Destructure new prop
  allowDelete = false, // Default to false if not provided
}: EventCardProps) {
  const { user } = useAuth();

  const handleDeleteEvent = async () => {
    // Only proceed if current user is the owner and delete is allowed for this card context
    if (!user || user.uid !== ownerId || !allowDelete) {
      alert("You don't have permission to delete this event here.");
      return;
    }

    try {
      // Confirm deletion to prevent accidental removal
      if (!confirm(`Are you sure you want to delete the event "${title}"? This action cannot be undone.`)) {
        return;
      }

      // 1. Delete associated media from Firebase Storage
      // The error "A listener indicated an asynchronous response..." is often a harmless Chrome warning
      // but ensure your storage deletion logic is robust.
      for (const url of mediaUrls) {
        try {
          const decodedUrl = decodeURIComponent(url.split('?')[0]);
          const pathStart = decodedUrl.indexOf("/o/") + 3;
          const filePath = decodedUrl.substring(pathStart).replace(/%2F/g, "/");

          const storageRef = ref(storage, filePath);
          await deleteObject(storageRef);
          console.log(`Deleted file from storage: ${filePath}`);
        } catch (storageError: any) {
          console.warn(`Warning: Could not delete storage file ${url}. It might already be deleted or permission issue (not critical for event doc deletion):`, storageError.message);
          // Don't block event document deletion if a single file fails
        }
      }

      // 2. Delete the event document from Firestore
      // Use the 'eventType' prop to dynamically get the collection name
      await deleteDoc(doc(db, eventType, eventId));
      alert("Event deleted successfully ✅");

      // Optional: Trigger a page reload or update the parent state to remove the card
      // A full page reload is a simple way to reflect changes immediately for now.
      // In a more complex app, you might use a callback to update parent component state.
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      alert(`Failed to delete event ❌: ${error.message || "Unknown error"}`);
    }
  };

  const isOwner = user?.uid === ownerId; // Check if the current user is the owner

  return (
    <div className="rounded-2xl shadow-lg overflow-hidden bg-white hover:scale-105 transition-transform duration-300 ease-in-out border border-gray-200">
      <Image
        src={imageUrl}
        alt={title}
        width={400}
        height={280}
        className="w-full h-64 object-cover"
      />
      <div className="p-4 space-y-3">
        <h2 className="text-xl font-bold text-gray-800 line-clamp-1">{title}</h2>
        <p className="text-base text-gray-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {location}
        </p>

        <div className="space-y-2 mt-4">
          <button
            onClick={onViewEvent}
            className="w-full px-4 py-3 bg-black text-white text-base font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
          >
            👀 View Event
          </button>

          {/* Delete Button - now conditional on isOwner AND allowDelete prop */}
          {isOwner && allowDelete && (
            <button
              onClick={handleDeleteEvent}
              className="w-full px-4 py-3 bg-red-600 text-white text-base font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-md"
            >
              🗑️ Delete
            </button>
          )}

          {/* Optional bottomAction */}
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
