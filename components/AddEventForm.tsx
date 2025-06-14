// components/AddEventForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import {
  CalendarIcon,
  MapPinIcon,
  BookOpenIcon, // For Story/Message
  DollarSignIcon, // For Contribution Note
  PhoneIcon, // For Mpesa Number
  ImageIcon, // For Image Upload
  VideoIcon, // For Video Upload
  PlusCircle, // For submit button
  LockIcon // For access denied
} from "lucide-react"; // Importing new icons

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
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [names, setNames] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [story, setStory] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [images, setImages] = useState<FileList | null>(null);
  const [videos, setVideos] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<number | ''>(''); // State for the goal amount

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100 p-6">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl p-8 text-center border border-rose-200 space-y-5">
          <LockIcon className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-rose-700 mb-4">Access Denied</h1>
          <p className="text-lg text-gray-700 mb-6">
            You must be signed in to add an event.
          </p>
          <button
            onClick={() => router.push('/login')} // Direct to login page
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            Sign In Now
          </button>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!beneficiaryPhone || beneficiaryPhone.length < 10) {
      alert("Please provide a valid Mpesa phone number (at least 10 digits) for receiving gifts.");
      setLoading(false);
      return;
    }

    if (goal === '' || Number(goal) <= 0) {
      alert("Please set a valid fundraising goal (must be a positive number).");
      setLoading(false);
      return;
    }

    try {
      const imageUrls = images ? await uploadFiles(images, "images") : [];
      const videoUrls = videos ? await uploadFiles(videos, "videos") : [];

      const docRef = await addDoc(collection(db, eventType), {
        title,
        names,
        location,
        date,
        story,
        contributionNote,
        beneficiaryPhone: beneficiaryPhone,
        images: imageUrls,
        videos: videoUrls,
        createdAt: Timestamp.now(),
        ownerId: user.uid,
        raised: 0,
        goal: Number(goal), // Ensure goal is stored as a number
      });

      const userProfileRef = doc(db, "users", user.uid);
      await updateDoc(userProfileRef, {
        eventCount: increment(1),
      });

      alert("🎉 Event saved successfully!");
      router.push(`/events/${eventType}/${docRef.id}`); // Redirect to the newly created event's detail page
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to submit event. Please try again.");
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

  const displayEventType = typeof eventType === "string" ? eventType.slice(0, -1) : "";
  const emoji = eventType === "weddings" ? "💍" : eventType === "birthdays" ? "🎂" : "👶"; // Dynamic emoji

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto bg-white shadow-2xl rounded-3xl p-8 border border-rose-100 space-y-6">
        <h1 className="text-3xl font-extrabold text-rose-700 text-center mb-6 flex items-center justify-center gap-3">
          <span className="text-4xl">{emoji}</span> Add {displayEventType} Event
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-rose-500" /> {titleLabel}
            </label>
            <input
              id="title"
              type="text"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="e.g., John & Jane's Dream Wedding"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="names" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-rose-500" /> {coupleOrPersonLabel}
            </label>
            <input
              id="names"
              type="text"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="e.g., John & Jane Doe (for wedding), Alex Smith (for birthday)"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-rose-500" /> Location
            </label>
            <input
              id="location"
              type="text"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="e.g., Nairobi, Kenya"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-rose-500" /> Date
            </label>
            <input
              id="date"
              type="date"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="story" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-rose-500" /> Story / Message
            </label>
            <textarea
              id="story"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="Share your special story or message for this event..."
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              required
            />
          </div>

          <div>
            <label htmlFor="contributionNote" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" /> Why are you raising funds? (Optional)
            </label>
            <textarea
              id="contributionNote"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="Explain how contributions will help, e.g., 'to fund our honeymoon' or 'for baby's first needs'..."
              value={contributionNote}
              onChange={(e) => setContributionNote(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <label htmlFor="beneficiaryPhone" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <PhoneIcon className="w-5 h-5 text-green-600" /> Mpesa Number for Gifts (e.g., 0712345678)
            </label>
            <input
              id="beneficiaryPhone"
              type="tel"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="Recipient's Mpesa Phone"
              value={beneficiaryPhone}
              onChange={(e) => setBeneficiaryPhone(e.target.value)}
              required
            />
          </div>

          {/* New: Goal Input Field */}
          <div>
            <label htmlFor="goal" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" /> Fundraising Goal (KES)
            </label>
            <input
              id="goal"
              type="number"
              min="1"
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="e.g., 100000"
              value={goal}
              onChange={(e) => setGoal(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label htmlFor="images" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-600" /> Upload Images
            </label>
            <input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(e.target.files)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-100 file:text-purple-700
                hover:file:bg-purple-200 transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="videos" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <VideoIcon className="w-5 h-5 text-blue-600" /> Upload Videos (optional)
            </label>
            <input
              id="videos"
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => setVideos(e.target.files)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-100 file:text-blue-700
                hover:file:bg-blue-200 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose-600 text-white px-6 py-3 rounded-xl hover:bg-rose-700 font-bold text-lg transition-colors shadow-lg flex items-center justify-center gap-2 transform hover:scale-105"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <PlusCircle className="w-6 h-6" /> Submit Event
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
