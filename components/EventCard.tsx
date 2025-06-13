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
      // Confirm deletion to prevent accidental removal
      if (!confirm(`Are you sure you want to delete the event "${title}"?`)) {
        return;
      }

      // Determine the collection name (e.g., 'weddings', 'birthdays', 'babyshowers')
      // This is a basic assumption, a more robust solution would pass eventType as a prop
      const eventTypeFromId = eventId.includes("wedding") ? "weddings" :
                              eventId.includes("birthday") ? "birthdays" :
                              eventId.includes("babyshower") ? "babyshowers" :
                              "events"; // Default or error case

      // Delete associated media from Firebase Storage
      for (const url of mediaUrls) {
        try {
          // Firebase Storage URLs are complex; extract the path carefully
          // Example: https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/images%2Fuuid-filename.jpg?alt=media...
          const decodedUrl = decodeURIComponent(url.split('?')[0]); // Get rid of query params and decode
          const pathStart = decodedUrl.indexOf("/o/") + 3; // Find start of the actual path
          const filePath = decodedUrl.substring(pathStart).replace(/%2F/g, "/"); // Get path and replace encoded slashes

          const storageRef = ref(storage, filePath);
          await deleteObject(storageRef);
          console.log(`Deleted file: ${filePath}`);
        } catch (storageError) {
          console.warn(`Could not delete storage file ${url}:`, storageError);
          // Don't block event deletion if a single file fails
        }
      }

      // Delete the event document from Firestore
      await deleteDoc(doc(db, eventTypeFromId, eventId)); // Use dynamic collection name
      alert("Event deleted successfully ✅");
      // Optional: Trigger a page refresh or update the parent state to remove the card
      window.location.reload(); // Simple reload for now to reflect deletion
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event ❌");
    }
  };

  const isOwner = user?.uid === ownerId;

  return (
    <div className="rounded-2xl shadow-lg overflow-hidden bg-white hover:scale-105 transition-transform duration-300 ease-in-out border border-gray-200">
      <Image
        src={imageUrl}
        alt={title}
        width={400} // Increase width to match new card size
        height={280} // <<< INCREASED HEIGHT FROM 250 to 280 (or higher, e.g., 300)
        className="w-full h-64 object-cover" // <<< INCREASED HEIGHT FROM h-48 to h-64
      />
      <div className="p-4 space-y-3"> {/* Adjusted spacing */}
        <h2 className="text-xl font-bold text-gray-800 line-clamp-1">{title}</h2> {/* Larger title, clamp for overflow */}
        <p className="text-base text-gray-600 flex items-center gap-1"> {/* Consistent text size */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {location}
        </p>

        <div className="space-y-2 mt-4"> {/* Added top margin */}
          <button
            onClick={onViewEvent}
            className="w-full px-4 py-3 bg-black text-white text-base font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
          >
            👀 View Event
          </button>

          {/* Optional Delete Button */}
          {isOwner && (
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
