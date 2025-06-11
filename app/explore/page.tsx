// app/explore/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Make sure db is imported
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth"; // To get the current user for FollowButton
import FollowButton from "@/components/FollowButton"; // Import FollowButton

interface UserProfilePreview {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  // Add other fields you want to display, e.g., eventCount
  eventCount?: number;
}

export default function ExploreUsersPage() {
  const [users, setUsers] = useState<UserProfilePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth(); // Get current logged-in user

  useEffect(() => {
    const fetchAllUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersCollectionRef = collection(db, "users");
        // Order by createdAt to show most recent users first
        const q = query(usersCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedUsers: UserProfilePreview[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Filter out the current user's own profile from the list
          if (currentUser && doc.id === currentUser.uid) {
            return; // Skip current user
          }
          fetchedUsers.push({
            uid: doc.id,
            displayName: userData.displayName || "Unknown User",
            photoURL: userData.photoURL || "/default-avatar.png",
            bio: userData.bio || "",
            eventCount: userData.eventCount || 0,
          });
        });
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    // Fetch users only after auth loading is complete
    if (!authLoading) {
      fetchAllUsers();
    }
  }, [currentUser, authLoading]); // Re-fetch if currentUser or authLoading changes

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
        </svg>
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center p-6 text-gray-600">
        <h1 className="text-2xl font-bold mb-4 text-rose-600">Explore Users</h1>
        <p>No other users found yet.</p>
        {currentUser && <p>Be the first to create an event and share your profile!</p>}
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-rose-700 text-center mb-8">Explore Users</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((userProfile) => (
          <div
            key={userProfile.uid}
            className="bg-white shadow-lg rounded-xl p-4 flex flex-col items-center text-center space-y-3"
          >
            <img
              src={userProfile.photoURL}
              alt={`${userProfile.displayName}'s profile`}
              className="w-20 h-20 rounded-full object-cover border-2 border-rose-400"
            />
            <h2 className="text-xl font-semibold text-gray-800">{userProfile.displayName}</h2>
            {userProfile.bio && <p className="text-sm text-gray-600 italic line-clamp-2">"{userProfile.bio}"</p>}
            <p className="text-xs text-gray-500">{userProfile.eventCount} Events Created</p>

            <button
              onClick={() => router.push(`/profile/${userProfile.uid}`)}
              className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-colors w-full"
            >
              View Profile
            </button>
            {/* Show FollowButton only if current user is logged in */}
            {currentUser && (
              <div className="w-full">
                <FollowButton targetUserId={userProfile.uid} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}