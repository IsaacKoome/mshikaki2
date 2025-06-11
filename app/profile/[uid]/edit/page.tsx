// app/profile/[uid]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export default function EditProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          setPhotoURL(data.photoURL || null);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const userRef = doc(db, "users", uid);
      let newPhotoURL = photoURL;

      if (photoFile) {
        const fileRef = ref(storage, `profilePics/${uid}-${photoFile.name}`);
        const snap = await uploadBytes(fileRef, photoFile);
        newPhotoURL = await getDownloadURL(snap.ref);
      }

      await updateDoc(userRef, {
        displayName,
        bio,
        photoURL: newPhotoURL,
      });

      alert("✅ Profile updated!");
      router.push(`/profile/${uid}`);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Try again.");
    }
  };

  if (!isOwner) {
    return (
      <div className="p-6 text-center text-red-600">
        🚫 You are not authorized to edit this profile.
      </div>
    );
  }

  if (loading) {
    return <p className="p-6 text-gray-500 italic">Loading profile...</p>;
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-rose-600 mb-6">Edit Your Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-white shadow p-6 rounded-xl">
        <div>
          <label className="block font-medium">Display Name</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Bio</label>
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Say something about yourself..."
          />
        </div>

        <div>
          <label className="block font-medium">Profile Picture</label>
          {photoURL && <img src={photoURL} alt="Current" className="h-24 w-24 rounded-full mb-2" />}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
        </div>

        <button
          type="submit"
          className="bg-rose-600 text-white px-4 py-2 rounded hover:bg-rose-700"
        >
          Save Changes
        </button>
      </form>
    </main>
  );
}
