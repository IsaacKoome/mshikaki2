// app/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react"; // Added useMemo
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarIcon, MapPinIcon, Loader2, SparklesIcon, ChevronDownIcon, SearchIcon } from "lucide-react"; // Added SearchIcon
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input"; // Assuming Input component is available globally

// Interfaces
interface EventData {
  id: string;
  title: string;
  location: string;
  images: string[];
  date?: string;
  collectionName: string;
  isPublic: boolean;
  eventCategory: 'weddings' | 'birthdays' | 'babyshowers' | 'party' | 'concert' | 'community' | 'church' | 'fundraiser' | 'other';
  ownerId: string;
  createdAt: Timestamp;
  story?: string; // Ensure story is part of the interface for search
}

export default function HomePage() {
  const [rawCategoryFilteredEvents, setRawCategoryFilteredEvents] = useState<EventData[]>([]); // Stores events filtered by category, before text search
  const [displayedEvents, setDisplayedEvents] = useState<EventData[]>([]); // Final events displayed after text search
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EventData['eventCategory'] | "all">("all");
  const [searchTerm, setSearchTerm] = useState(""); // New state for search term

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const eventCollections = ["weddings", "birthdays", "babyshowers"]; // Your existing collections

    const fetchPublicEvents = () => {
      // Reset states for a fresh fetch
      setRawCategoryFilteredEvents([]); 
      setDisplayedEvents([]);
      setLoadingEvents(true);
      setError(null);
      let fetchedCount = 0;
      let hasErrorInFetch = false;
      const currentCombinedEvents: EventData[] = []; // Temporary array to build the combined list before setting state

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
            where("eventCategory", "==", selectedCategory),
            orderBy("createdAt", "desc")
          );
        }
        
        console.log(`[DEBUG] Setting up listener for collection: ${colName}, with query:`, JSON.stringify(qCol.withConverter(null)._query)); // More readable query log


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
              eventCategory: data.eventCategory || 'other', 
              ownerId: data.ownerId,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromDate(new Date(data.createdAt as any || Date.now())),
              story: data.story || '', // Ensure story is always a string for search
            };
            
            console.log(`[DEBUG] Processing event change: Type=${change.type}, ID=${eventData.id}, Title=${eventData.title}, isPublic=${eventData.isPublic}, eventCategory=${eventData.eventCategory}`);

            const eventKey = `${eventData.collectionName}-${eventData.id}`;
            const existingIndexInCombinedList = currentCombinedEvents.findIndex(e => `${e.collectionName}-${e.id}` === eventKey);

            if (change.type === "added") {
                if (existingIndexInCombinedList === -1) {
                    currentCombinedEvents.push(eventData);
                }
            } else if (change.type === "modified") {
                if (existingIndexInCombinedList > -1) {
                    currentCombinedEvents[existingIndexInCombinedList] = eventData;
                }
            } else if (change.type === "removed") {
                if (existingIndexInCombinedList > -1) {
                    currentCombinedEvents.splice(existingIndexInCombinedList, 1);
                }
            }
          });

          // After processing changes for this collection, update the raw list
          const uniqueEvents = Array.from(new Map(currentCombinedEvents.map(event => [`${event.collectionName}-${event.id}`, event])).values());
          uniqueEvents.sort((a, b) => {
            const aTime = (a.createdAt as Timestamp)?.toMillis() || 0;
            const bTime = (b.createdAt as Timestamp)?.toMillis() || 0;
            return bTime - aTime;
          });
          
          setRawCategoryFilteredEvents([...uniqueEvents]); // Set the raw (category-filtered) events here

          fetchedCount++;
          if (fetchedCount === eventCollections.length && !hasErrorInFetch) {
            setLoadingEvents(false);
            console.log("[DEBUG] All initial fetches completed for categories.");
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
      console.log("[DEBUG] All listeners unsubscribed on category/component change.");
    };
  }, [selectedCategory]); // Re-run effect when selectedCategory changes

  // Use useMemo to filter events based on search term.
  // This will only re-run when rawCategoryFilteredEvents or searchTerm changes.
  useEffect(() => {
    if (loadingEvents && rawCategoryFilteredEvents.length === 0) {
      // Still loading or no events after category filter, so no displayable events yet
      setDisplayedEvents([]);
      return;
    }

    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowercasedSearchTerm) {
      // If no search term, display all category-filtered events
      setDisplayedEvents(rawCategoryFilteredEvents);
    } else {
      // Filter by search term across title, location, story
      const filtered = rawCategoryFilteredEvents.filter(event => 
        event.title.toLowerCase().includes(lowercasedSearchTerm) ||
        event.location.toLowerCase().includes(lowercasedSearchTerm) ||
        (event.story && event.story.toLowerCase().includes(lowercasedSearchTerm)) // Check story only if it exists
      );
      setDisplayedEvents(filtered);
    }
    console.log(`[DEBUG] Events after search filter '${searchTerm}':`, displayedEvents.map(e => e.title));
  }, [rawCategoryFilteredEvents, searchTerm, loadingEvents]); // Depend on raw events and search term


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

          {/* Search Bar and Category Filter */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by title, location, or story..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>
            
            {/* Category Filter Dropdown */}
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value as EventData['eventCategory'] | "all")}
            >
              <SelectTrigger className="w-full sm:w-[200px] bg-white rounded-lg shadow-sm border border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                <SelectItem value="all">All Categories</SelectItem>
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
          ) : displayedEvents.length === 0 ? ( // Changed from events.length to displayedEvents.length
            <p className="text-center text-gray-500 text-lg py-8">
                No public events found matching your criteria. Be the first to create one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedEvents.map((event) => ( // Changed from events.map to displayedEvents.map
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
