"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarIcon, MapPinIcon } from "lucide-react";

interface EventData {
  title: string;
  location: string;
  images: string[];
  videos?: string[];
  goal: number;
  raised?: number;
  story?: string;
  date?: string;
  [key: string]: any;
}

interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

export default function EventDetailPage({ id, collectionName }: Props) {
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
          setEvent(snapshot.data() as EventData);
        } else {
          setEvent(null);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    const fetchContributions = () => {
      const q = query(
        collection(db, "contributions"),
        where("eventId", "==", id)
      );
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
      alert("Please enter a valid amount.");
      return;
    }
    try {
      await addDoc(collection(db, "contributions"), {
        eventId: id,
        amount,
        timestamp: new Date(),
      });

      const eventRef = doc(db, collectionName, id);
      await updateDoc(eventRef, {
        raised: (event?.raised || 0) + amount,
      });

      setAmount(0);
    } catch (error) {
      console.error("Contribution error:", error);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!event) return <p className="p-6">Event not found.</p>;

  const goal = event.goal || 100000;
  const progress = Math.min((contributions / goal) * 100, 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="text-rose-600 hover:text-rose-800 text-sm underline"
      >
        ← Go Back
      </button>

      <h1 className="text-3xl font-bold text-rose-600">{event.title}</h1>

      <div className="text-gray-600 flex items-center gap-2">
        <MapPinIcon className="w-4 h-4" />
        <span>{event.location}</span>
      </div>

      {event.date && (
        <div className="text-gray-600 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          <span>{event.date}</span>
        </div>
      )}

      {event.story && (
        <div className="bg-white shadow p-4 rounded-lg border text-gray-700">
          <p className="whitespace-pre-line">{event.story}</p>
        </div>
      )}

      <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600">
        KES {contributions.toLocaleString()} raised of KES{" "}
        {goal.toLocaleString()}
      </p>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="bg-rose-600 hover:bg-rose-700">
            Contribute Now
          </Button>
        </DialogTrigger>
        <DialogContent className="space-y-4">
          <DialogTitle className="sr-only">Contribution Dialog</DialogTitle>

          <h2 className="text-lg font-semibold text-rose-500">Contribute</h2>

          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount in KES"
            min="0"
          />
          <Button onClick={handleContribute}>Submit</Button>
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {(event.images || []).map((url, index) => (
          <div
            key={index}
            className="relative w-full h-64 rounded-xl overflow-hidden shadow-md"
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
