// app/profile/[uid]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid'; // For unique file names

export default function EditProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null); // Renamed for clarity
  const [previewPhotoURL, setPreviewPhotoURL] = useState<string | null>(null); // For image preview
  const [loadingProfile, setLoadingProfile] = useState(true); // For initial profile fetch
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission

  const isOwner = user?.uid === uid;

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(data.displayName || "");
          setBio(data.bio || "");
          setCurrentPhotoURL(data.photoURL || "/default-avatar.png"); // Set current photo URL, with fallback
          setPreviewPhotoURL(data.photoURL || "/default-avatar.png"); // Initialize preview with current
        } else {
          console.warn("User profile not found for UID:", uid);
          // Optionally redirect if profile doesn't exist
          router.push(`/profile/${uid}`);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        alert("Error loading profile. Please try again.");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [uid, router]); // Add router to dependency array as per Next.js linting

  // Effect to update preview when a new file is selected
  useEffect(() => {
    if (photoFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(photoFile);
    } else if (!photoFile && currentPhotoURL) {
      setPreviewPhotoURL(currentPhotoURL); // Reset preview if file is cleared
    } else {
        setPreviewPhotoURL("/default-avatar.png"); // Fallback if no photo
    }
  }, [photoFile, currentPhotoURL]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); // Set submitting state

    try {
      const userRef = doc(db, "users", uid);
      let newPhotoURL = currentPhotoURL; // Start with the current photo URL

      if (photoFile) {
        // Use a unique name for the file to prevent conflicts, e.g., UID + UUID
        const fileRef = ref(storage, `profilePics/${uid}/${uuidv4()}-${photoFile.name}`);
        const snap = await uploadBytes(fileRef, photoFile);
        newPhotoURL = await getDownloadURL(snap.ref);
      }

      await updateDoc(userRef, {
        displayName,
        bio,
        photoURL: newPhotoURL,
      });

      alert("✅ Profile updated successfully!");
      router.push(`/profile/${uid}`);
    } catch (error: any) { // Catch as 'any' for broader error handling
      console.error("Error updating profile:", error);
      // Provide more specific feedback for common errors
      let errorMessage = "Failed to update profile. Please try again.";
      if (error.code === 'storage/unauthorized') {
        errorMessage = "Permission denied. Check Firebase Storage rules.";
      } else if (error.code === 'firestore/permission-denied') {
        errorMessage = "Permission denied. Check Firestore rules for 'users' collection.";
      }
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false); // Reset submitting state
    }
  };

  if (!isOwner) {
    return (
      <div className="p-6 text-center text-red-600">
        🚫 You are not authorized to edit this profile.
      </div>
    );
  }

  if (loadingProfile) { // Use specific loading state
    return <p className="p-6 text-gray-500 italic">Loading profile...</p>;
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-rose-600 mb-6">Edit Your Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-white shadow p-6 rounded-xl">
        <div>
          <label htmlFor="displayName" className="block font-medium mb-1">Display Name</label>
          <input
            id="displayName"
            type="text"
            className="w-full border rounded p-2 focus:ring-rose-500 focus:border-rose-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="bio" className="block font-medium mb-1">Bio</label>
          <textarea
            id="bio"
            className="w-full border rounded p-2 focus:ring-rose-500 focus:border-rose-500"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Say something about yourself..."
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Profile Picture</label>
          {previewPhotoURL && (
            <img
              src={previewPhotoURL} // Use preview URL for immediate feedback
              alt="Current Profile"
              className="h-24 w-24 rounded-full object-cover mb-2 border border-gray-300"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-rose-50 file:text-rose-700
                       hover:file:bg-rose-100"
          />
          {photoFile && <p className="text-xs text-gray-500 mt-1">Selected: {photoFile.name}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting} // Disable button during submission
          className={`w-full py-2 px-4 rounded font-semibold transition-colors
                     ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
        >
          {isSubmitting ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>
    </main>
  );
}