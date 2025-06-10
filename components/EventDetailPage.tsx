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
import {
  CalendarIcon,
  MapPinIcon,
  InfoIcon,
  ChevronDownIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface EventData {
  title: string;
  location: string;
  images: string[];
  videos?: string[];
  goal: number;
  raised?: number;
  story?: string;
  date?: string;
  contributionNote?: string;
  [key: string]: any;
}

interface Props {
  id: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
}

export default function EventDetailPage({ id, collectionName }: Props) {
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<number | "">(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contributions, setContributions] = useState(0);
  const [contributionList, setContributionList] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);
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
      const q = query(collection(db, "contributions"), where("eventId", "==", id));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((doc) => doc.data());
        const sorted = docs.sort((a, b) => {
          const t1 = a.timestamp?.toMillis?.() || 0;
          const t2 = b.timestamp?.toMillis?.() || 0;
          return t1 - t2;
        });

        const total = sorted.reduce((sum, doc) => sum + (doc.amount || 0), 0);
        setContributions(total);
        setContributionList(sorted);
      });
      return unsub;
    };

    fetchEvent();
    const unsub = fetchContributions();
    return () => unsub();
  }, [id, collectionName]);

  useEffect(() => {
    if (user) {
      setName(user.displayName || "");
    }
  }, [user]);

  const maskPhone = (phone: string) => {
    return phone.length >= 7
      ? phone.slice(0, 2) + "***" + phone.slice(-2)
      : "07***00";
  };

  const handleContribute = async () => {
    if (!amount || amount <= 0 || !name || !phone) {
      alert("Please fill in all fields correctly.");
      return;
    }

    try {
      await addDoc(collection(db, "contributions"), {
        eventId: id,
        amount,
        name,
        phone,
        timestamp: new Date(),
      });

      const eventRef = doc(db, collectionName, id);
      await updateDoc(eventRef, {
        raised: (event?.raised || 0) + amount,
      });

      setAmount(0);
      setPhone("");
      setDialogOpen(false);
    } catch (error) {
      console.error("Contribution error:", error);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!event) return <p className="p-6">Event not found.</p>;

  const goal = event.goal || 100000;
  const progress = Math.min((contributions / goal) * 100, 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gray-50 min-h-screen">
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

      {event.contributionNote && (
        <Collapsible open={showNote} onOpenChange={setShowNote} className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-yellow-800 font-medium">
              <InfoIcon className="w-5 h-5" />
              Why Support This Event?
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDownIcon className={`w-4 h-4 transform transition-transform ${showNote ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="text-sm text-gray-700 whitespace-pre-line mt-1">
            {event.contributionNote}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600">
        KES {contributions.toLocaleString()} raised of KES {goal.toLocaleString()}
      </p>

      {/* Contribute Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-rose-600 hover:bg-rose-700 w-full sm:w-auto">
            Contribute Now
          </Button>
        </DialogTrigger>
        <DialogContent className="space-y-4 max-w-sm w-full mx-auto p-6 rounded-xl shadow-lg z-50 bg-white">
          <DialogTitle className="text-center text-rose-600 font-bold text-lg">
            🎁 Make a Contribution
          </DialogTitle>

          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
          />
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (e.g., 0712345678)"
          />
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="KES"
            min="1"
          />

          <Button onClick={handleContribute} className="w-full">
            Submit
          </Button>
        </DialogContent>
      </Dialog>

      {/* Images */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {(event.images || []).map((url, index) => (
          <div key={index} className="relative w-full h-64 rounded-xl overflow-hidden shadow-md">
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

      {/* Contribution List */}
      <div className="bg-white mt-8 p-4 rounded-lg shadow-md border">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">🎁 Contributions</h3>
        <ul className="space-y-2">
          {contributionList.length === 0 ? (
            <p className="text-gray-500 italic">No contributions yet. Be the first!</p>
          ) : (
            contributionList.map((c, index) => (
              <li key={index} className="text-sm text-gray-700">
                {c.name || "Anonymous"} – {maskPhone(c.phone || "")} – KES{" "}
                {c.amount?.toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
