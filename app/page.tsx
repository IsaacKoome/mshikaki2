// app/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
// Import necessary Firestore types for explicit typing
import { collection, query, where, orderBy, onSnapshot, Timestamp, GeoPoint, QuerySnapshot, DocumentData, DocumentChange, FirestoreError, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is your initialized Firestore instance
import { CalendarIcon, MapPinIcon, Loader2, SparklesIcon, ChevronDownIcon, SearchIcon, LocateIcon, GlobeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";

// Correct import for geofire-common
import { geohashQueryBounds, distanceBetween, geohashForLocation } from "geofire-common";


// Interfaces
interface EventData {
  id: string;
  title: string;
  location: string;
  images: string[];
  date?: string;
  collectionName: string;
  isPublic: boolean;
  eventCategory: 'wedding' | 'birthday' | 'babyshower' | 'party' | 'concert' | 'community' | 'church' | 'fundraiser' | 'other';
  ownerId: string;
  createdAt: Timestamp;
  story?: string;
  latitude?: number;
  longitude?: number;
  coordinates?: GeoPoint; // Firebase's GeoPoint object
  geohash?: string; // New: To store geohash for efficient querying
  distance?: number; // Added for sorting/displaying distance in km
}

// Helper function to get browser location
const getBrowserLocation = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error("Geolocation not supported or not available in this environment."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve({ latitude, longitude });
      },
      (err: GeolocationPositionError) => {
        let errorMessage = "Failed to get your location.";
        if (err.code === err.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable it for this site in browser settings.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMessage = "Location information is unavailable.";
        } else if (err.code === err.TIMEOUT) {
          errorMessage = "Request to get user location timed out.";
        }
        reject(new Error(errorMessage));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

export default function HomePage() {
  const [rawCategoryFilteredEvents, setRawCategoryFilteredEvents] = useState<EventData[]>([]);
  const [displayedEvents, setDisplayedEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true); // Fixed typo here (missing = useState(true))
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EventData['eventCategory'] | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // States for geolocation
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocationFilterActive, setIsLocationFilterActive] = useState(false);
  const [loadingUserLocation, setLoadingUserLocation] = useState(false);
  const SEARCH_RADIUS_KM = 20; // Default search radius in kilometers


  // Effect to get user's location when component mounts or location filter is enabled
  useEffect(() => {
    if (isLocationFilterActive && userLocation === null && !loadingUserLocation) {
      setLoadingUserLocation(true);
      getBrowserLocation()
        .then((location) => {
          setUserLocation(location);
          toast.success("Your location has been captured!", {
            description: `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`,
          });
        })
        .catch((err) => {
          console.warn("[GEO] Location fetch error:", err.message);
          toast.error("Location Error", {
            description: err.message,
            duration: 5000,
          });
          setUserLocation(null); // Clear location if error
          setIsLocationFilterActive(false); // Optionally disable filter if location fails
        })
        .finally(() => {
          setLoadingUserLocation(false);
        });
    } else if (!isLocationFilterActive) {
      setUserLocation(null);
    }
  }, [isLocationFilterActive, userLocation, loadingUserLocation]);


  // Effect to fetch events (either all public or nearby using geohashing)
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const eventCollections = ["weddings", "birthdays", "babyshowers"];

    setRawCategoryFilteredEvents([]);
    setDisplayedEvents([]);
    setLoadingEvents(true);
    setError(null);

    const fetchEvents = async () => {
      const tempEvents: EventData[] = [];

      try {
        if (isLocationFilterActive && userLocation) {
          // --- Geo-query logic using geofire-common ---
          // FIXED: Explicitly type center as [number, number]
          const center: [number, number] = [userLocation.latitude, userLocation.longitude];
          const radiusInM = SEARCH_RADIUS_KM * 1000;

          const bounds = geohashQueryBounds(center, radiusInM);

          const promises: Promise<QuerySnapshot<DocumentData>>[] = [];

          for (const colName of eventCollections) {
            for (const b of bounds) {
              const q = query(
                collection(db, colName),
                orderBy('geohash'),
                where('geohash', '>=', b[0]),
                where('geohash', '<=', b[1]),
                where('isPublic', '==', true)
              );
              promises.push(getDocs(q));
            }
          }

          const snapshots = await Promise.all(promises);
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
              const data = doc.data();
              // FIXED: Use data.coordinates.latitude/longitude if available, fall back to flat lat/lng
              const eventLat = data.coordinates?.latitude ?? data.latitude;
              const eventLng = data.coordinates?.longitude ?? data.longitude;

              // Ensure event has valid numerical coordinates and geohash for distance calculation
              if (eventLat !== undefined && eventLng !== undefined && data.geohash) {
                // FIXED: Pass event coordinates as a [number, number] tuple
                const distance = distanceBetween([eventLat, eventLng], center);

                if (distance <= SEARCH_RADIUS_KM) {
                  tempEvents.push({
                    id: doc.id,
                    collectionName: doc.ref.parent.id,
                    ...data,
                    distance,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromDate(new Date(data.createdAt as any || Date.now())),
                  } as EventData);
                }
              }
            });
          });

          tempEvents.sort((a, b) => (a.distance || 0) - (b.distance || 0));

        } else {
          // --- Regular query logic (no location filter) ---
          const fetchPromises: Promise<QuerySnapshot<DocumentData>>[] = [];
          for (const colName of eventCollections) {
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
            fetchPromises.push(getDocs(qCol));
          }

          const snapshots = await Promise.all(fetchPromises);
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
              const data = doc.data();
              tempEvents.push({
                id: doc.id,
                collectionName: doc.ref.parent.id,
                title: data.title,
                location: data.location,
                images: data.images || [],
                date: data.date,
                isPublic: data.isPublic || false,
                eventCategory: data.eventCategory || 'other',
                ownerId: data.ownerId,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromDate(new Date(data.createdAt as any || Date.now())),
                story: data.story || '',
                latitude: data.latitude,
                longitude: data.longitude,
                coordinates: data.coordinates,
                geohash: data.geohash,
              });
            });
          });

          tempEvents.sort((a, b) => {
            const aTime = (a.createdAt as Timestamp)?.toMillis() || 0;
            const bTime = (b.createdAt as Timestamp)?.toMillis() || 0;
            return bTime - aTime;
          });
        }

        const uniqueEvents = Array.from(new Map(tempEvents.map(event => [`${event.collectionName}-${event.id}`, event])).values());
        setRawCategoryFilteredEvents(uniqueEvents);

      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events. Please check console for details and ensure Firestore indexes for 'geohash' are set if using location filter.");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [selectedCategory, isLocationFilterActive, userLocation]);


  // Effect to filter events based on search term
  useEffect(() => {
    if (loadingEvents && rawCategoryFilteredEvents.length === 0 && (!isLocationFilterActive || userLocation === null)) {
      setDisplayedEvents([]);
      return;
    }

    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowercasedSearchTerm) {
      setDisplayedEvents(rawCategoryFilteredEvents);
    } else {
      const filtered = rawCategoryFilteredEvents.filter(event =>
        event.title.toLowerCase().includes(lowercasedSearchTerm) ||
        event.location.toLowerCase().includes(lowercasedSearchTerm) ||
        (event.story && event.story.toLowerCase().includes(lowercasedSearchTerm))
      );
      setDisplayedEvents(filtered);
    }
  }, [rawCategoryFilteredEvents, searchTerm, loadingEvents, isLocationFilterActive, userLocation]);


  // Helper for displaying distance
  const formatDistance = (distance: number | undefined) => {
    if (distance === undefined || distance === null) return null;
    return `${distance.toFixed(1)} km away`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-6">
      <Toaster richColors />
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
              disabled={isLocationFilterActive && userLocation === null && !loadingUserLocation}
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

          {/* New: Location Filter Checkbox */}
          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl border border-blue-200 shadow-sm mb-6">
            <Checkbox
              id="locationFilter"
              checked={isLocationFilterActive}
              onCheckedChange={(checked) => {
                setIsLocationFilterActive(Boolean(checked));
                if (Boolean(checked) && userLocation === null && !loadingUserLocation) {
                  toast.info("Attempting to get your location...", {
                    description: "Please allow browser location access.",
                    duration: 3000,
                  });
                }
              }}
              className="w-5 h-5 border-blue-400 text-blue-600 focus:ring-blue-500 focus:ring-offset-background"
            />
            <Label htmlFor="locationFilter" className="text-base font-medium text-blue-800 leading-none cursor-pointer flex items-center gap-2">
              {isLocationFilterActive ? <LocateIcon className="w-5 h-5 text-blue-600" /> : <GlobeIcon className="w-5 h-5 text-gray-500" />}
              Show Events Near Me ({SEARCH_RADIUS_KM} km radius)
              {loadingUserLocation && <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-500" />}
            </Label>
            {isLocationFilterActive && userLocation === null && !loadingUserLocation && (
              <p className="text-sm text-red-500 ml-auto">Location needed!</p>
            )}
          </div>

          {/* Conditional Rendering of Events */}
          {loadingEvents || loadingUserLocation ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="ml-3 text-lg text-gray-600">
                {loadingUserLocation ? "Getting your location..." : "Loading amazing events..."}
              </p>
            </div>
          ) : error ? (
            <p className="text-center text-red-500 text-lg">{error}</p>
          ) : displayedEvents.length === 0 ? (
            <p className="text-center text-gray-500 text-lg py-8">
              No public events found matching your criteria. Be the first to create one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedEvents.map((event) => (
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
                        {/* Display distance if available and location filter is active */}
                        {isLocationFilterActive && event.distance !== undefined && (
                          <span className="ml-2 text-blue-700 font-semibold text-xs">
                            ({formatDistance(event.distance)})
                          </span>
                        )}
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
      <Toaster richColors />
    </div>
  );
}
