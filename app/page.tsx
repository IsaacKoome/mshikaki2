// app/page.tsx
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
  ownerId: string;
  eventType: string;
}

export default function HomePage() {
  const router = useRouter();

  const [weddingEvents, setWeddingEvents] = useState<EventItem[]>([]);
  const [birthdayEvents, setBirthdayEvents] = useState<EventItem[]>([]);
  const [babyShowerEvents, setBabyShowerEvents] = useState<EventItem[]>([]);

  const [isLoadingWeddings, setIsLoadingWeddings] = useState(true);
  const [isLoadingBirthdays, setIsLoadingBirthdays] = useState(true);
  const [isLoadingBabyShowers, setIsLoadingBabyShowers] = useState(true);

  useEffect(() => {
    const fetchEvents = async (
      type: string,
      setter: React.Dispatch<React.SetStateAction<EventItem[]>>,
      setLoading: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      try {
        const q = query(collection(db, type), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          location: doc.data().location,
          images: doc.data().images || [],
          ownerId: doc.data().ownerId || "",
          eventType: type, // Pass eventType to EventCard
        }));
        setter(events);
      } catch (error) {
        console.error(`Error fetching ${type}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents("weddings", setWeddingEvents, setIsLoadingWeddings);
    fetchEvents("birthdays", setBirthdayEvents, setIsLoadingBirthdays);
    fetchEvents("babyshowers", setBabyShowerEvents, setIsLoadingBabyShowers);
  }, []);


  const handleViewEvent = (type: string, id: string) => {
    router.push(`/events/${type}/${id}`);
  };

  const renderEventSection = (
    label: string,
    type: string,
    events: EventItem[],
    isLoading: boolean
  ) => (
    <section className="space-y-4 bg-white p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-rose-600 border-b pb-2 mb-4">{label}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2 text-gray-500 py-8">
          <svg className="animate-spin h-7 w-7 mr-3 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z" />
          </svg>
          <span className="italic">Loading {label.toLowerCase()} events...</span>
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-400 italic text-center py-8">No {label.toLowerCase()} events found yet.</p>
      ) : (
        <div className="flex space-x-6 overflow-x-auto scrollbar-hide pb-2">
          {events.map((event) => (
            <div key={event.id} className="min-w-[320px]">
              <EventCard
                key={event.id}
                title={event.title}
                location={event.location}
                imageUrl={event.images[0] || "https://placehold.co/400x280/E0E0E0/333333?text=No+Image"}
                onViewEvent={() => handleViewEvent(type, event.id)}
                eventId={event.id}
                mediaUrls={event.images}
                ownerId={event.ownerId}
                eventType={event.eventType} // Pass eventType
                allowDelete={false} // <<< Explicitly hide delete button on homepage
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-10 bg-gray-100 rounded-lg shadow-inner py-10">
      <h1 className="text-3xl font-bold text-rose-700 text-center mb-8">Discover Events</h1>

      <div className="flex flex-wrap justify-center gap-4 p-4 bg-white rounded-xl shadow-lg">
        <Link href="/add-event/add-wedding" className="flex items-center justify-center bg-emerald-500 text-white font-bold
          px-4 py-2 text-base rounded-full hover:bg-emerald-600 transition-all duration-200 shadow-md
          sm:px-6 sm:py-3 sm:text-lg">
          <span role="img" aria-label="wedding ring" className="mr-2">💖</span> Add Wedding
        </Link>
        <Link href="/add-event/add-birthday" className="flex items-center justify-center bg-blue-500 text-white font-bold
          px-4 py-2 text-base rounded-full hover:bg-blue-600 transition-all duration-200 shadow-md
          sm:px-6 sm:py-3 sm:text-lg">
          <span role="img" aria-label="birthday cake" className="mr-2">🎂</span> Add Birthday
        </Link>
        <Link href="/add-event/add-babyshower" className="flex items-center justify-center bg-purple-500 text-white font-bold
          px-4 py-2 text-base rounded-full hover:bg-purple-600 transition-all duration-200 shadow-md
          sm:px-6 sm:py-3 sm:text-lg">
          <span role="img" aria-label="baby bottle" className="mr-2">👶</span> Add Baby Shower
        </Link>
      </div>

      {renderEventSection("Weddings", "weddings", weddingEvents, isLoadingWeddings)}
      {renderEventSection("Birthdays", "birthdays", birthdayEvents, isLoadingBirthdays)}
      {renderEventSection("Baby Showers", "babyshowers", babyShowerEvents, isLoadingBabyShowers)}
    </main>
  );
}
