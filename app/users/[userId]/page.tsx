// app/users/[userId]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { CalendarIcon, MapPinIcon, LinkIcon, GiftIcon, UserIcon as LucideUserIcon, ArrowLeftIcon, SparklesIcon } from 'lucide-react'; // Renamed UserIcon to LucideUserIcon to avoid conflict
import Link from 'next/link';
import { useAuth } from '@/lib/auth'; // To check if current user is viewing their own profile

// Interfaces for data
interface UserProfile {
  id: string; // The document ID will be the user's UID
  uid: string; // The user's UID
  displayName: string;
  photoURL?: string;
  bio?: string; // Optional user-defined bio
  createdAt?: Timestamp; // Use Timestamp type for consistency if stored as such
}

interface EventData {
  id: string;
  title: string;
  location: string;
  date?: string;
  images: string[];
  collectionName: string; // e.g., 'weddings', 'birthdays'
}

interface ContributionRecord {
    eventId: string;
    collectionName: string;
    amount: number;
    timestamp: Timestamp; // Using Timestamp
    contributorId?: string; // Ensure this field exists in your actual contributions
}


export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>(); // Get userId from dynamic route
  const router = useRouter();
  const { user: currentUser } = useAuth(); // Current logged-in user

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createdEvents, setCreatedEvents] = useState<EventData[]>([]);
  const [contributedEvents, setContributedEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError("User ID is missing from URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setProfile({
            id: userDocSnap.id,
            uid: userDocSnap.id, // UID is the document ID
            displayName: data.displayName || 'Unnamed User',
            photoURL: data.photoURL || '/default-avatar.png',
            bio: data.bio || undefined,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
          });
        } else {
          // If no specific user profile doc, try to get basic info if it's the current user
          if (currentUser && currentUser.uid === userId) {
            setProfile({
              id: currentUser.uid,
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Your Profile',
              photoURL: currentUser.photoURL || '/default-avatar.png',
              bio: 'This is your profile!', // Default bio for current user if no custom one exists
            });
          } else {
            // Fallback for unknown user if no profile doc exists
            setProfile({
              id: userId,
              uid: userId,
              displayName: 'Unknown User',
              photoURL: '/default-avatar.png',
              bio: 'No profile information available for this user.',
            });
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError("Failed to load user profile due to an unexpected error.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, currentUser]);


  useEffect(() => {
    const fetchUserEvents = async () => {
      if (!profile?.uid) { // Ensure profile.uid is available before fetching events
        setCreatedEvents([]);
        setContributedEvents([]);
        setLoadingEvents(false);
        return;
      }

      setLoadingEvents(true);
      const tempCreatedEvents: EventData[] = [];
      const tempContributedEvents: EventData[] = [];
      const visitedEventUniqueKeys = new Set<string>(); // Use a unique key for event: `${collectionName}-${eventId}`

      try {
        // --- Fetch Events Created by this User ---
        const eventCollections = ['weddings', 'birthdays', 'babyshowers']; // Your event collection names
        for (const colName of eventCollections) {
          const qCreated = query(collection(db, colName), where('ownerId', '==', profile.uid), orderBy('date', 'desc'));
          const createdSnap = await getDocs(qCreated);
          createdSnap.forEach(docSnap => {
            const data = docSnap.data();
            const eventUniqueKey = `${colName}-${docSnap.id}`;
            if (!visitedEventUniqueKeys.has(eventUniqueKey)) {
              tempCreatedEvents.push({
                id: docSnap.id,
                collectionName: colName,
                title: data.title,
                location: data.location,
                date: data.date,
                images: data.images?.[0] ? [data.images[0]] : [], // Only take first image for display
              });
              visitedEventUniqueKeys.add(eventUniqueKey);
            }
          });
        }
        setCreatedEvents(tempCreatedEvents);


        // --- Fetch Contributions by this User to find related events ---
        // IMPORTANT: This assumes your 'contributions' collection has a 'contributorId' field.
        // If it doesn't, you need to add it when contributions are saved.
        const qContributions = query(
            collection(db, 'contributions'),
            where('contributorId', '==', profile.uid) // *** Ensure 'contributorId' field exists in your contributions docs ***
        );
        const contributedSnap = await getDocs(qContributions);

        const eventFetches: Promise<void>[] = [];
        // Use a Map to easily track unique events by their combined collectionName and eventId
        const uniqueContributedEventRefs = new Map<string, { collectionName: string, eventId: string }>();

        contributedSnap.forEach(contribDoc => {
            const data = contribDoc.data() as ContributionRecord;
            const eventUniqueKey = `${data.collectionName}-${data.eventId}`;
            // Add to unique map only if not already processed (either created or contributed)
            if (!visitedEventUniqueKeys.has(eventUniqueKey)) {
                uniqueContributedEventRefs.set(eventUniqueKey, {
                    collectionName: data.collectionName,
                    eventId: data.eventId
                });
                visitedEventUniqueKeys.add(eventUniqueKey);
            }
        });

        // Fetch event details for unique contributed events
        for (const { collectionName: cName, eventId: eId } of Array.from(uniqueContributedEventRefs.values())) {
            eventFetches.push(
                getDoc(doc(db, cName, eId))
                    .then(eventDocSnap => {
                        if (eventDocSnap.exists()) {
                            const data = eventDocSnap.data();
                            tempContributedEvents.push({
                                id: eventDocSnap.id,
                                collectionName: cName,
                                title: data.title,
                                location: data.location,
                                date: data.date,
                                images: data.images?.[0] ? [data.images[0]] : [], // Only take first image for display
                            });
                        }
                    })
                    .catch(e => console.error(`Error fetching contributed event ${eId} from ${cName}:`, e))
            );
        }

        await Promise.all(eventFetches);
        setContributedEvents(tempContributedEvents);

      } catch (err) {
        console.error("Error fetching user's events:", err);
        // Do not set global error, as profile might still be loaded. Handle specific error for events if needed.
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchUserEvents();
  }, [profile?.uid]); // Depend on profile.uid to refetch events when profile loads


  if (loading) return <p className="p-6 text-center text-gray-500">Loading user profile...</p>;
  if (error) return <p className="p-6 text-center text-red-500">Error: {error}</p>;
  if (!profile) return <p className="p-6 text-center text-gray-500">User profile not found.</p>;

  const isCurrentUserProfile = currentUser && currentUser.uid === userId;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-100 min-h-screen p-6">
      <main className="max-w-4xl mx-auto space-y-8 p-6 bg-white shadow-2xl rounded-3xl border border-purple-100">

        {/* Go Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold text-base transition-colors py-2 px-4 rounded-lg border border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Go Back
        </button>

        {/* Profile Header */}
        <section className="text-center space-y-4 mb-8">
          <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
            <Image
              src={profile.photoURL || '/default-avatar.png'}
              alt={profile.displayName || 'User'}
              fill
              className="object-cover"
              sizes="128px"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-purple-800 leading-tight">
            {profile.displayName}
            {isCurrentUserProfile && (
              <span className="ml-2 text-sm bg-purple-200 text-purple-800 px-2 py-1 rounded-full font-semibold">
                (You)
              </span>
            )}
          </h1>
          {profile.bio && (
            <p className="text-lg text-gray-700 max-w-2xl mx-auto whitespace-pre-line">
              <SparklesIcon className="inline-block w-5 h-5 text-purple-600 mr-1" />
              {profile.bio}
            </p>
          )}
          {/* Add a button for current user to edit profile */}
          {isCurrentUserProfile && (
            <Link href={`/profile/${profile.uid}/edit`} passHref>
        <button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-full shadow-md transition-all duration-300 transform hover:scale-105">
            Edit Profile
        </button>
    </Link>
          )}
        </section>

        {/* Events Created by User */}
        <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-purple-700 mb-5 flex items-center gap-3">
            <LinkIcon className="w-6 h-6 text-purple-600" /> Events Created by {profile.displayName}
          </h2>
          {loadingEvents ? (
            <p className="text-center text-gray-500 italic">Loading events...</p>
          ) : createdEvents.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">This user has not created any events yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdEvents.map(event => (
                <Link key={event.id} href={`/events/${event.collectionName}/${event.id}`} passHref>
                  <div className="block p-4 border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow bg-purple-50 hover:bg-purple-100 group">
                    <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden">
                      <Image
                        src={event.images?.[0] || '/placeholder-event.jpg'}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-purple-800 group-hover:text-purple-900">{event.title}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4" /> {event.location}
                    </p>
                    {event.date && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" /> {event.date}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Events Contributed To by User */}
        <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-teal-700 mb-5 flex items-center gap-3">
            <GiftIcon className="w-6 h-6 text-teal-600" /> Events {isCurrentUserProfile ? "You've" : profile.displayName + " has"} Contributed To
          </h2>
          {loadingEvents ? (
            <p className="text-center text-gray-500 italic">Loading events...</p>
          ) : contributedEvents.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">This user has not contributed to any events yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contributedEvents.map(event => (
                <Link key={event.id} href={`/events/${event.collectionName}/${event.id}`} passHref>
                  <div className="block p-4 border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow bg-teal-50 hover:bg-teal-100 group">
                    <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden">
                      <Image
                        src={event.images?.[0] || '/placeholder-event.jpg'}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-teal-800 group-hover:text-teal-900">{event.title}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4" /> {event.location}
                    </p>
                    {event.date && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" /> {event.date}
                      </p>
                    )}
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
