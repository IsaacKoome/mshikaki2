"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EventCard from "@/components/EventCard";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EventItem {
  id: string;
  title: string;
  location: string;
  images: string[];
}

export default function HomePage() {
  const router = useRouter();

  const [weddingEvents, setWeddingEvents] = useState<EventItem[]>([]);
  const [birthdayEvents, setBirthdayEvents] = useState<EventItem[]>([]);
  const [babyShowerEvents, setBabyShowerEvents] = useState<EventItem[]>([]);

  // Fetch weddings
  useEffect(() => {
    const fetchEvents = async (type: string, setter: React.Dispatch<React.SetStateAction<EventItem[]>>) => {
      const q = query(collection(db, type), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        location: doc.data().location,
        images: doc.data().images || [],
      }));
      setter(events);
    };

    fetchEvents("weddings", setWeddingEvents);
    fetchEvents("birthdays", setBirthdayEvents);
    fetchEvents("babyshowers", setBabyShowerEvents);
  }, []);

  const handleViewEvent = (id: string) => {
    router.push(`/events/${id}`);
  };

  const renderEventSection = (title: string, events: EventItem[]) => (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-gray-500">No {title.toLowerCase()} added yet.</p>
      ) : (
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide pb-2">
          {events.map((event) => (
            <div key={event.id} className="min-w-[280px]">
              <EventCard
                title={event.title}
                location={event.location}
                imageUrl={event.images[0] || "https://via.placeholder.com/400x250?text=No+Image"}
                onViewEvent={() => handleViewEvent(event.id)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
        <h1 className="bg-rose-600 text-white px-4 py-2 text-2xl font-bold rounded-xl">
          🎉 Discover Events
        </h1>

        <div className="flex flex-wrap gap-2">
          <Link href="/add-event/add-wedding" className="bg-emerald-400 text-white px-4 py-2 rounded-xl">
            + 💖 Wedding
          </Link>
          <Link href="/add-event/add-birthday" className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600">
            + 🎂 Birthday
          </Link>
          <Link href="/add-event/add-babyshower" className="bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600">
            + 👶 Baby Shower
          </Link>
        </div>
      </div>

      {renderEventSection("Weddings", weddingEvents)}
      {renderEventSection("Birthdays", birthdayEvents)}
      {renderEventSection("Baby Showers", babyShowerEvents)}
    </main>
  );
}
