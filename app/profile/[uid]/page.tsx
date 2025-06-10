// app/profile/[uid]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EventCard from "@/components/EventCard"; // Assuming you have this component for displaying events
import { useAuth } from "@/lib/auth"; // To check if it's the current user's profile

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  createdAt?: Date; // Firestore Timestamp will be converted to Date
  eventCount?: number; // Optional, as we might not always have this
}

interface EventItem {
  id: string;
  title: string;
  location: string;
  images: string[];
  ownerId: string;
  eventType: string; // Add eventType to link back to detail page
}

export default function UserProfilePage() {
  const router = useRouter();
  const { uid } = useParams<{ uid: string }>(); // Get the UID from the URL
  const { user: currentUser, loading: authLoading } = useAuth(); // Current logged-in user

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<EventItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoadingProfile(false);
      setProfileError("User ID is missing from the URL.");
      return;
    }

    const fetchUserProfile = async () => {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setProfile({
            uid: userDocSnap.id,
            displayName: userData.displayName || "Unknown User",
            photoURL: userData.photoURL,
            bio: userData.bio,
            createdAt: userData.createdAt?.toDate(), // Convert Firestore Timestamp to Date
            eventCount: userData.eventCount || 0,
          });
        } else {
          // If no custom profile exists, try to get basic info from Firebase Auth itself
          // (This part is tricky because you can't query auth users by UID directly without admin SDK)
          // For now, we'll assume a profile doc exists or display 'Unknown User'
          setProfileError("User profile not found.");
          setProfile(null); // Clear previous profile if not found
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setProfileError("Failed to load user profile.");
      } finally {
        setLoadingProfile(false);
      }
    };

    const fetchUserEvents = async () => {
        setLoadingEvents(true);
        try {
            const eventTypes = ["weddings", "birthdays", "babyshowers"];
            const allUserEvents: EventItem[] = [];

            for (const type of eventTypes) {
                const q = query(
                    collection(db, type),
                    where("ownerId", "==", uid),
                    orderBy("createdAt", "desc")
                );
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    allUserEvents.push({
                        id: doc.id,
                        title: doc.data().title,
                        location: doc.data().location,
                        images: doc.data().images || [],
                        ownerId: doc.data().ownerId || "",
                        eventType: type // Store the event type for routing
                    });
                });
            }
            setUserEvents(allUserEvents.sort((a, b) => {
                // You might want a more sophisticated sort if `createdAt` isn't consistent across collections
                // For now, assuming they are ordered by query.
                return 0; // Maintain order from queries or add a real sort if needed
            }));
        } catch (error) {
            console.error("Error fetching user events:", error);
            // Optionally set an error state for events
        } finally {
            setLoadingEvents(false);
        }
    };


    fetchUserProfile();
    fetchUserEvents();
  }, [uid]); // Rerun effect when UID changes

  if (loadingProfile || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
        </svg>
        Loading profile...
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="text-center p-6 text-red-600">
        <p>{profileError}</p>
        <p>Please ensure the UID in the URL is correct.</p>
      </div>
    );
  }

  if (!profile) {
    return (
        <div className="text-center p-6 text-gray-600">
            <p>No profile data found for this user.</p>
        </div>
    );
  }

  const isCurrentUserProfile = currentUser?.uid === uid;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-lg rounded-xl p-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
        <div className="flex-shrink-0">
          <img
            src={profile.photoURL || "/default-avatar.png"} // Provide a default avatar
            alt={`${profile.displayName}'s profile`}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-rose-500"
          />
        </div>
        <div className="text-center md:text-left flex-grow">
          <h1 className="text-3xl font-bold text-rose-700">{profile.displayName}</h1>
          {profile.bio && <p className="text-gray-600 mt-2 italic">"{profile.bio}"</p>}
          <p className="text-sm text-gray-500 mt-1">
            Joined: {profile.createdAt ? profile.createdAt.toLocaleDateString() : "N/A"}
          </p>
          <p className="text-sm text-gray-500">
            Events Created: {profile.eventCount !== undefined ? profile.eventCount : "..."}
          </p>

          {/* Follow/Unfollow button placeholder (will implement later) */}
          {!isCurrentUserProfile && (
            <button className="mt-4 bg-blue-500 text-white px-5 py-2 rounded-full hover:bg-blue-600 transition-colors">
              Follow (Coming Soon)
            </button>
          )}

          {isCurrentUserProfile && (
            <button
              onClick={() => router.push(`/profile/${uid}/edit`)} // Or open a modal for editing
              className="mt-4 bg-purple-500 text-white px-5 py-2 rounded-full hover:bg-purple-600 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-rose-600">
          {isCurrentUserProfile ? "My Events" : `${profile.displayName}'s Events`}
        </h2>
        {loadingEvents ? (
          <div className="flex items-center space-x-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z" />
            </svg>
            <span className="italic">Loading events...</span>
          </div>
        ) : userEvents.length === 0 ? (
          <p className="text-gray-400 italic">
            {isCurrentUserProfile ? "You haven't created any events yet." : `${profile.displayName} hasn't created any events yet.`}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userEvents.map((event) => (
              <EventCard
                key={event.id}
                title={event.title}
                location={event.location}
                imageUrl={event.images[0] || "https://via.placeholder.com/400x250?text=No+Image"}
                onViewEvent={() => router.push(`/events/${event.eventType}/${event.id}`)}
                eventId={event.id}
                mediaUrls={event.images}
                ownerId={event.ownerId}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}