// components/FollowButton.tsx
"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

interface FollowButtonProps {
  targetUserId: string; // The UID of the profile being followed/unfollowed
  targetUserDisplayName: string; // NEW: Display name of the user being targeted
  onFollowChange?: (newStatus: boolean) => void; // NEW: Optional callback for parent to update counts
}

export default function FollowButton({ targetUserId, targetUserDisplayName, onFollowChange }: FollowButtonProps) {
  const { user } = useAuth(); // Current logged-in user
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // For follow/unfollow action

  // Effect to fetch initial follow status
  useEffect(() => {
    // If no user is logged in or no target user is provided, stop loading and return
    if (!user || !targetUserId) {
      setLoading(false);
      return;
    }

    const checkFollowStatus = async () => {
      try {
        // Reference to the current user's 'following' subcollection for the target user
        const followRef = doc(db, "users", user.uid, "following", targetUserId);
        const docSnap = await getDoc(followRef);
        setIsFollowing(docSnap.exists()); // Set true if the document exists (meaning they are following)
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setLoading(false); // Set loading to false regardless of success or failure
      }
    };

    checkFollowStatus();
  }, [user, targetUserId]); // Re-run this effect when the logged-in user or the target user changes

  // Handles the follow/unfollow action when the button is clicked
  const handleFollowToggle = async () => {
    // Ensure a user is logged in before allowing follow/unfollow
    if (!user) {
      alert("You must be logged in to follow users.");
      return;
    }
    // Prevent multiple rapid clicks while an action is being processed
    if (isProcessing) return;

    setIsProcessing(true); // Set processing state to disable the button

    // Firestore document references for both sides of the follow relationship
    const currentUserFollowingRef = doc(db, "users", user.uid, "following", targetUserId);
    const targetUserFollowersRef = doc(db, "users", targetUserId, "followers", user.uid);

    try {
      if (isFollowing) {
        // If currently following, perform unfollow action
        await deleteDoc(currentUserFollowingRef); // Remove from current user's following list
        await deleteDoc(targetUserFollowersRef); // Remove current user from target's followers list
        setIsFollowing(false); // Update local state
        alert(`You unfollowed ${targetUserDisplayName}.`); // User feedback
        if (onFollowChange) onFollowChange(false); // Notify parent component
      } else {
        // If not currently following, perform follow action
        await setDoc(currentUserFollowingRef, { createdAt: Timestamp.now() }); // Add to current user's following list
        await setDoc(targetUserFollowersRef, { createdAt: Timestamp.now() }); // Add current user to target's followers list
        setIsFollowing(true); // Update local state
        alert(`You are now following ${targetUserDisplayName}!`); // User feedback
        if (onFollowChange) onFollowChange(true); // Notify parent component

        // ✅ FUTURE NOTIFICATION SYSTEM INTEGRATION:
        // This is where you would trigger a notification to the target user
        // For example, by writing a document to a 'notifications' subcollection of the target user:
        /*
        await addDoc(collection(db, "users", targetUserId, "notifications"), {
            type: "follow",
            fromUserUid: user.uid,
            fromUserDisplayName: user.displayName || "Someone", // Use current user's display name
            createdAt: Timestamp.now(),
            read: false, // Notification status
            message: `${user.displayName || "Someone"} started following you.`, // Notification message
        });
        */
      }
    } catch (error) {
      console.error("Error toggling follow status:", error);
      alert("Failed to update follow status. Please try again."); // Generic error feedback
    } finally {
      setIsProcessing(false); // Reset processing state
    }
  };

  // Render a loading state for the button while initial status is being fetched
  if (loading) {
    return (
      <button className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">
        Loading...
      </button>
    );
  }

  // Render the Follow/Unfollow button
  return (
    <button
      onClick={handleFollowToggle} // Attach the toggle handler
      disabled={isProcessing} // Disable if an action is in progress
      className={`px-4 py-2 rounded-lg transition duration-200 w-full
        ${isFollowing
          ? "bg-gray-400 text-white hover:bg-gray-500" // Style for unfollow button
          : "bg-rose-500 text-white hover:bg-rose-600"} // Style for follow button
        ${isProcessing ? "opacity-70 cursor-not-allowed" : ""}` // Style when processing
      }
    >
      {isProcessing ? "Processing..." : isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}