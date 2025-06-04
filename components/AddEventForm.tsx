"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

interface AddEventFormProps {
  eventType: "weddings" | "birthdays" | "babyshowers";
  titleLabel: string;
  coupleOrPersonLabel: string;
}

export default function AddEventForm({
  eventType,
  titleLabel,
  coupleOrPersonLabel,
}: AddEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [names, setNames] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [story, setStory] = useState("");
  const [images, setImages] = useState<FileList | null>(null);
  const [videos, setVideos] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const imageUrls = images ? await uploadFiles(images, "images") : [];
      const videoUrls = videos ? await uploadFiles(videos, "videos") : [];

      await addDoc(collection(db, eventType), {
        title,
        names,
        location,
        date,
        story,
        images: imageUrls,
        videos: videoUrls,
        createdAt: Timestamp.now(),
      });

      alert("🎉 Event saved!");
      router.push("/");
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files: FileList, folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fileRef = ref(storage, `${folder}/${uuidv4()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      urls.push(url);
    }
    return urls;
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-rose-500">🎉 Add {eventType.slice(0, -1)} Event</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white shadow p-6 rounded-xl">
        <div>
          <label className="block font-medium">{titleLabel}</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">{coupleOrPersonLabel}</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Name(s)"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Location</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Event location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Date</label>
          <input
            type="date"
            className="w-full border rounded p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Story / Message</label>
          <textarea
            className="w-full border rounded p-2"
            placeholder="Say something about this event..."
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={5}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Upload Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(e.target.files)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Upload Videos (optional)</label>
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => setVideos(e.target.files)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-rose-500 text-white px-4 py-2 rounded hover:bg-rose-600"
        >
          {loading ? "Submitting..." : "Submit Event"}
        </button>
      </form>
    </main>
  );
}
