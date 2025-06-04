"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  // getDocs, // Removed: no direct usage outside of onSnapshot's internal mechanism
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Define a more specific type for your event data
interface EventData {
  title: string;
  location: string;
  images: string[];
  goal: number; // Assuming 'goal' is a number
  raised?: number; // 'raised' might be optional or start at 0
  // Add other properties that an event might have from Firestore
  [key: string]: any; // Allow for other unknown properties if necessary, but try to specify
}

interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

export default function EventDetailPage({ id, collectionName }: Props) {
  // Use the specific EventData type for event state
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [contributions, setContributions] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchEvent = async () => {
      const ref = doc(db, collectionName, id);
      try {
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          // Cast the data to EventData type
          setEvent(snapshot.data() as EventData);
        } else {
          console.warn(`Event with ID ${id} not found in collection ${collectionName}`);
          setEvent(null); // Explicitly set to null if not found
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        setEvent(null); // Handle error by setting event to null
      } finally {
        setLoading(false);
      }
    };

    const fetchContributions = () => {
      const q = query(
        collection(db, "contributions"),
        where("eventId", "==", id)
      );
      // The onSnapshot listener implicitly gets documents, so getDocs isn't directly called by you.
      const unsub = onSnapshot(q, (snapshot) => {
        const total = snapshot.docs.reduce(
          (sum, doc) => sum + (doc.data().amount || 0),
          0
        );
        setContributions(total);
      });
      return unsub;
    };

    fetchEvent();
    const unsub = fetchContributions();
    return () => unsub();
  }, [id, collectionName]);

  const handleContribute = async () => {
    if (amount <= 0) {
      alert("Please enter a positive amount to contribute.");
      return;
    }
    try {
      await addDoc(collection(db, "contributions"), {
        eventId: id,
        amount,
        timestamp: new Date(),
      });
      const eventRef = doc(db, collectionName, id);
      // Ensure 'event' is not null before attempting to read 'raised'
      await updateDoc(eventRef, {
        raised: (event?.raised || 0) + amount,
      });
      setAmount(0); // Reset amount after successful contribution
    } catch (error) {
      console.error("Error during contribution:", error);
      alert("Failed to process contribution. Please try again.");
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!event) return <p className="p-6">Event not found.</p>;

  // Ensure 'event' is not null or undefined before accessing properties
  const goal = event.goal || 100000;
  const progress = Math.min((contributions / goal) * 100, 100);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <button
        onClick={() => router.back()}
        className="text-blue-600 underline hover:text-blue-800"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold">{event.title}</h1>
      <p className="text-gray-600">{event.location}</p>

      <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
        <div
          className="bg-green-500 h-4 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-600">
        KES {contributions.toLocaleString()} raised of KES {goal.toLocaleString()}
      </p>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="mt-2">Contribute Now</Button>
        </DialogTrigger>
        <DialogContent className="space-y-4">
          <h2 className="text-lg font-semibold">Enter Contribution Amount</h2>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="KES"
            min="0" // Prevent negative contributions
          />
          <Button onClick={handleContribute}>Submit</Button>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {/* Safely access images array and ensure it's not null/undefined */}
        {(event.images || []).map((url: string, index: number) => (
          <div
            key={index}
            className="relative w-full h-64 rounded overflow-hidden"
          >
            <Image
              src={url}
              alt={`Image ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}