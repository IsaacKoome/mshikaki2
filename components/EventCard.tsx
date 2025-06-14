// components/EventCard.tsx
import React from "react";
import Image from "next/image";
import Link from "next/link"; // Import Link from next/link for client-side navigation
import { deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { CalendarIcon, MapPinIcon, Trash2Icon } from "lucide-react"; // Import icons for date/location

// Props definition
interface EventCardProps {
  title: string;
  location: string;
  imageUrl: string;
  eventId: string;
  mediaUrls: string[];
  // onViewEvent: () => void; // Removed - entire card is now clickable
  bottomAction?: React.ReactNode;
  ownerId: string;
  eventType: string;
  allowDelete?: boolean;
  date?: string; // NEW: Add date prop
  story?: string; // NEW: Add story prop for excerpt
}

export default function EventCard({
  title,
  location,
  imageUrl,
  eventId,
  mediaUrls,
  // onViewEvent, // Removed from destructuring
  bottomAction,
  ownerId,
  eventType,
  allowDelete = false,
  date, // Destructure new prop
  story, // Destructure new prop
}: EventCardProps) {
  const { user } = useAuth();

  // Determine if the current user is the owner
  const isOwner = user?.uid === ownerId;

  const handleDeleteEvent = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to the event detail page
    e.stopPropagation(); // Stop event propagation to prevent Link from firing

    if (!user || user.uid !== ownerId || !allowDelete) {
      alert("You don't have permission to delete this event here.");
      return;
    }

    try {
      if (!confirm(`Are you sure you want to delete the event "${title}"? This action cannot be undone.`)) {
        return;
      }

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
        }
      }

      await deleteDoc(doc(db, eventType, eventId));
      alert("Event deleted successfully ✅");
      window.location.reload(); // Reload the page to reflect the deletion
    } catch (error: any) {
      console.error("Error deleting event:", error);
      alert(`Failed to delete event ❌: ${error.message || "Unknown error"}`);
    }
  };

  // Generate a short excerpt of the story
  const storyExcerpt = story && story.length > 100 ? `${story.substring(0, 97)}...` : story;

  return (
    // The entire card is now wrapped in a Next.js Link component
    <Link
      href={`/events/${eventType}/${eventId}`}
      className="block rounded-2xl shadow-lg overflow-hidden bg-white hover:scale-105 transition-transform duration-300 ease-in-out border border-gray-200 group"
      aria-label={`View details for ${title} event`}
    >
      <Image
        src={imageUrl}
        alt={title}
        width={400}
        height={280}
        className="w-full h-64 object-cover group-hover:opacity-90 transition-opacity" // Added group-hover effect
        priority // Consider adding priority for above-the-fold images
      />
      <div className="p-4 space-y-3">
        <h2 className="text-xl font-bold text-gray-800 line-clamp-1">{title}</h2>
        <p className="text-base text-gray-600 flex items-center gap-1">
          <MapPinIcon className="h-4 w-4 text-rose-500" /> {/* Replaced SVG with Lucide icon */}
          {location}
        </p>
        {date && ( // Display date if available
          <p className="text-base text-gray-600 flex items-center gap-1">
            <CalendarIcon className="h-4 w-4 text-rose-500" /> {/* Lucide icon */}
            {date}
          </p>
        )}
        {storyExcerpt ? ( // Display story excerpt or a default message
          <p className="text-sm text-gray-700 mt-2 line-clamp-3">
            {storyExcerpt}
          </p>
        ) : (
          <p className="text-sm text-gray-500 italic mt-2">
            Click to learn more about this special event!
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {/* Delete Button - now conditional on isOwner AND allowDelete prop */}
          {isOwner && allowDelete && (
            <button
              onClick={handleDeleteEvent}
              className="w-full px-4 py-3 bg-red-600 text-white text-base font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <Trash2Icon className="w-5 h-5" /> Delete Event
            </button>
          )}

          {/* Optional bottomAction (moved outside the Link to ensure it's still clickable if it contains buttons) */}
          {/* Note: If bottomAction contains elements that are also links, ensure they don't conflict with the parent Link */}
          {bottomAction && (
            <div className="w-full">
              {bottomAction}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
