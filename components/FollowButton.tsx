// components/FollowButton.tsx
"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

interface FollowButtonProps {
  targetUserId: string; // The UID of the profile being followed/unfollowed
}

export default function FollowButton({ targetUserId }: FollowButtonProps) {
  const { user } = useAuth(); // Current logged-in user
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // For follow/unfollow action

  // Fetch initial follow status
  useEffect(() => {
    if (!user || !targetUserId) {
      setLoading(false);
      return;
    }

    const checkFollowStatus = async () => {
      try {
        const followRef = doc(db, "users", user.uid, "following", targetUserId);
        const docSnap = await getDoc(followRef);
        setIsFollowing(docSnap.exists());
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkFollowStatus();
  }, [user, targetUserId]); // Re-run when user or targetUserId changes

  const handleFollowToggle = async () => {
    if (!user) {
      alert("You must be logged in to follow users.");
      return;
    }
    if (isProcessing) return; // Prevent multiple clicks

    setIsProcessing(true);

    const currentUserFollowingRef = doc(db, "users", user.uid, "following", targetUserId);
    const targetUserFollowersRef = doc(db, "users", targetUserId, "followers", user.uid);

    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(currentUserFollowingRef);
        await deleteDoc(targetUserFollowersRef);
        setIsFollowing(false);
        alert(`You unfollowed ${targetUserId}.`); // Replace with actual display name later
      } else {
        // Follow
        await setDoc(currentUserFollowingRef, { createdAt: Timestamp.now() });
        await setDoc(targetUserFollowersRef, { createdAt: Timestamp.now() });
        setIsFollowing(true);
        alert(`You are now following ${targetUserId}!`); // Replace with actual display name later
      }
    } catch (error) {
      console.error("Error toggling follow status:", error);
      alert("Failed to update follow status. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <button className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">Loading...</button>;
  }

  return (
    <button
      onClick={handleFollowToggle}
      disabled={isProcessing}
      className={`px-4 py-2 rounded-lg transition duration-200
        ${isFollowing
          ? "bg-gray-400 text-white hover:bg-gray-500" // Unfollow style
          : "bg-rose-500 text-white hover:bg-rose-600"} // Follow style
        ${isProcessing ? "opacity-70 cursor-not-allowed" : ""}`
      }
    >
      {isProcessing ? "Processing..." : isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}