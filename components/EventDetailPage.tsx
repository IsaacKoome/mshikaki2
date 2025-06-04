"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

export default function EventDetailPage({ id, collectionName }: Props) {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [contributions, setContributions] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchEvent = async () => {
      const ref = doc(db, collectionName, id);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setEvent(data);
      }
      setLoading(false);
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
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!event) return <p className="p-6">Event not found.</p>;

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
          />
          <Button onClick={handleContribute}>Submit</Button>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
