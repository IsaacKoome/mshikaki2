// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarIcon, MapPinIcon, Loader2, SparklesIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Interfaces
interface EventData {
  id: string;
  title: string;
  location: string;
  images: string[];
  date?: string;
  collectionName: string;
  isPublic: boolean;
  // Updated EventCategory to reflect plural names as seen in Firestore
  eventCategory: 'weddings' | 'birthdays' | 'babyshowers' | 'party' | 'concert' | 'community' | 'church' | 'fundraiser' | 'other';
  ownerId: string;
  createdAt: Timestamp;
}

export default function HomePage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default to 'all' or a specific category you want to show first
  const [selectedCategory, setSelectedCategory] = useState<EventData['eventCategory'] | "all">("all"); 

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const allPublicEvents: EventData[] = [];
    const eventCollections = ["weddings", "birthdays", "babyshowers"]; // These are plural collection names

    const fetchPublicEvents = () => {
      setEvents([]); 
      setLoadingEvents(true);
      setError(null);
      let fetchedCount = 0;
      let hasErrorInFetch = false;

      console.log(`[DEBUG] Fetching events for selected category: ${selectedCategory}`);

      eventCollections.forEach(colName => {
        let qCol;
        if (selectedCategory === "all") {
          qCol = query(
            collection(db, colName),
            where("isPublic", "==", true),
            orderBy("createdAt", "desc")
          );
        } else {
          qCol = query(
            collection(db, colName),
            where("isPublic", "==", true),
            where("eventCategory", "==", selectedCategory), // Filter by selected category
            orderBy("createdAt", "desc")
          );
        }
        
        console.log(`[DEBUG] Setting up listener for collection: ${colName}, with query:`, qCol.toString());


        const unsubscribe = onSnapshot(qCol, (snapshot) => {
          console.log(`[DEBUG] Received snapshot from ${colName}. Number of changes: ${snapshot.docChanges().length}`);
          
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const eventData: EventData = {
              id: change.doc.id,
              collectionName: colName,
              title: data.title,
              location: data.location,
              images: data.images || [],
              date: data.date,
              isPublic: data.isPublic || false,
              // Ensure eventCategory is a string, default to 'other' if missing
              eventCategory: data.eventCategory || 'other', 
              ownerId: data.ownerId,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromDate(new Date(data.createdAt as any || Date.now())),
            };
            
            console.log(`[DEBUG] Processing event change: Type=${change.type}, ID=${eventData.id}, Title=${eventData.title}, isPublic=${eventData.isPublic}, eventCategory=${eventData.eventCategory}`);


            const eventKey = `${eventData.collectionName}-${eventData.id}`;
            const existingIndexInCombinedList = allPublicEvents.findIndex(e => `${e.collectionName}-${e.id}` === eventKey);

            if (change.type === "added") {
                if (existingIndexInCombinedList === -1) {
                    allPublicEvents.push(eventData);
                }
            } else if (change.type === "modified") {
                if (existingIndexInCombinedList > -1) {
                    allPublicEvents[existingIndexInCombinedList] = eventData;
                }
            } else if (change.type === "removed") {
                if (existingIndexInCombinedList > -1) {
                    allPublicEvents.splice(existingIndexInCombinedList, 1);
                }
            }
          });

          const finalSortedEvents = [...allPublicEvents].sort((a, b) => {
            const aTime = (a.createdAt as Timestamp)?.toMillis() || 0;
            const bTime = (b.createdAt as Timestamp)?.toMillis() || 0;
            return bTime - aTime;
          });
          
          // Apply the current filter to the *combined* list before setting state
          const filteredDisplayEvents = selectedCategory === "all"
            ? finalSortedEvents
            : finalSortedEvents.filter(event => event.eventCategory === selectedCategory);

          console.log(`[DEBUG] Final events after filter (${selectedCategory}):`, filteredDisplayEvents.map(e => ({id: e.id, title: e.title, category: e.eventCategory})));
          setEvents(filteredDisplayEvents);

          fetchedCount++;
          if (fetchedCount === eventCollections.length && !hasErrorInFetch) {
            setLoadingEvents(false);
            console.log("[DEBUG] All initial fetches completed.");
          }
        }, (err) => {
          console.error(`Error fetching public events from ${colName} with category ${selectedCategory}:`, err);
          setError(`Failed to load public events from ${colName}. Please check your Firebase console for index requirements.`);
          hasErrorInFetch = true;
          setLoadingEvents(false);
        });
        unsubscribes.push(unsubscribe);
      });
    };

    fetchPublicEvents();

    return () => {
      unsubscribes.forEach(unsub => unsub());
      console.log("[DEBUG] All listeners unsubscribed.");
    };
  }, [selectedCategory]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-6">
      <main className="max-w-6xl mx-auto space-y-10">
        <section className="text-center bg-white p-8 rounded-3xl shadow-xl border border-red-100 mt-8">
          <h1 className="text-5xl font-extrabold text-red-800 mb-4 leading-tight">
            Celebrate Life's Moments
          </h1>
          <p className="text-xl text-gray-700 mb-6">
            Create, Share, and Discover all types of events and support your loved ones.
          </p>

          <Link href="/create-event" passHref>
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 text-xl font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105">
              ✨ Create New Event
            </Button>
          </Link>
        </section>

        <section className="bg-white p-8 rounded-3xl shadow-xl border border-blue-100">
          <h2 className="text-3xl font-bold text-blue-800 mb-6 flex items-center gap-3">
            <SparklesIcon className="w-8 h-8 text-blue-600" /> Discover Public Events
          </h2>

          {/* Category Filter Dropdown */}
          <div className="mb-6 flex justify-end">
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value as EventData['eventCategory'] | "all")}
            >
              <SelectTrigger className="w-full sm:w-[200px] bg-white rounded-lg shadow-sm border border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                <SelectItem value="all">All Categories</SelectItem>
                {/* Changed values to be PLURAL, matching Firestore data */}
                <SelectItem value="weddings">Wedding</SelectItem>
                <SelectItem value="birthdays">Birthday</SelectItem>
                <SelectItem value="babyshowers">Baby Shower</SelectItem>
                <SelectItem value="party">Party</SelectItem>
                <SelectItem value="concert">Concert</SelectItem>
                <SelectItem value="community">Community Gathering</SelectItem>
                <SelectItem value="church">Church Event</SelectItem>
                <SelectItem value="fundraiser">Fundraiser</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {loadingEvents ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="ml-3 text-lg text-gray-600">Loading amazing events...</p>
            </div>
          ) : error ? (
            <p className="text-center text-red-500 text-lg">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-center text-gray-500 text-lg py-8">
                No public events found for the selected category. Be the first to create one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map((event) => (
                <Link key={`${event.collectionName}-${event.id}`} href={`/events/${event.collectionName}/${event.id}`} passHref>
                  <div className="block bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 transform hover:-translate-y-1">
                    <div className="relative w-full h-48 bg-gray-200">
                      {event.images && event.images.length > 0 && typeof event.images[0] === 'string' && event.images[0] !== '' ? (
                        <Image
                          src={event.images[0]}
                          alt={event.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-400 text-sm">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="text-xl font-bold text-gray-900 leading-tight">
                        {event.title}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4 text-gray-500" /> {event.location}
                      </p>
                      {event.date && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4 text-gray-500" /> {event.date}
                        </p>
                      )}
                      {event.eventCategory && (
                        <p className="text-xs font-semibold text-blue-700 mt-2 px-2 py-1 bg-blue-100 rounded-full inline-block">
                            Category: {event.eventCategory.charAt(0).toUpperCase() + event.eventCategory.slice(1)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
