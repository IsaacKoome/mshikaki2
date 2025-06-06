// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EventCard from "@/components/EventCard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

interface EventItem {
  id: string;
  title: string;
  location: string;
  images: string[];
  ownerId: string;
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading,loginWithGoogle, logout } = useAuth();

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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{label}</h2>
      {isLoading ? (
        <div className="flex items-center space-x-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z" />
          </svg>
          <span className="italic">Loading {label.toLowerCase()} events...</span>
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-400 italic">No {label.toLowerCase()} events found yet.</p>
      ) : (
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide pb-2">
          {events.map((event) => (
            <div key={event.id} className="min-w-[280px]">
              <EventCard
                title={event.title}
                location={event.location}
                imageUrl={event.images[0] || "https://via.placeholder.com/400x250?text=No+Image"}
                onViewEvent={() => handleViewEvent(type, event.id)}
                eventId={event.id}
                mediaUrls={event.images}
                ownerId={event.ownerId}
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

        <div className="flex flex-col items-end gap-2">
          {authLoading ? (
            <p className="text-gray-500 italic">Loading user...</p>
          ) : user ? (
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <p className="text-sm font-medium">Welcome, {user.displayName || "User"}</p>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/add-event/add-wedding" className="bg-emerald-400 text-white px-4 py-2 rounded-xl hover:bg-emerald-500">
          + 💖 Wedding
        </Link>
        <Link href="/add-event/add-birthday" className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600">
          + 🎂 Birthday
        </Link>
        <Link href="/add-event/add-babyshower" className="bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600">
          + 👶 Baby Shower
        </Link>
      </div>

      {renderEventSection("Weddings", "weddings", weddingEvents, isLoadingWeddings)}
      {renderEventSection("Birthdays", "birthdays", birthdayEvents, isLoadingBirthdays)}
      {renderEventSection("Baby Showers", "babyshowers", babyShowerEvents, isLoadingBabyShowers)}
    </main>
  );
}
