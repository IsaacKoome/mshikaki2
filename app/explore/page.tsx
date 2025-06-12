// app/explore/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";

interface UserProfilePreview {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
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
        const followingUids: Set<string> = new Set();

        // If current user is logged in, fetch who they are following
        if (currentUser) {
          const followingSnap = await getDocs(collection(db, "users", currentUser.uid, "following"));
          followingSnap.forEach(doc => followingUids.add(doc.id));
        }

        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Filter out the current user's own profile AND users they already follow
          if (currentUser && (doc.id === currentUser.uid || followingUids.has(doc.id))) {
            return; // Skip current user and already followed users
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

    if (!authLoading) { // Fetch users only after auth loading is complete
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

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-rose-700 text-center mb-8">
        {currentUser ? "People you may know" : "Explore All Users"}
      </h1>

      {users.length === 0 ? (
        <div className="text-center p-6 text-gray-600">
          <p>No other users to show.</p>
          {currentUser && <p>You might be following everyone already, or no one else has joined yet!</p>}
          {!currentUser && <p>Sign in to discover people!</p>}
        </div>
      ) : (
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
                  <FollowButton
                    targetUserId={userProfile.uid}
                    targetUserDisplayName={userProfile.displayName}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
