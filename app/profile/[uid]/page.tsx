// app/profile/[uid]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import EventCard from "@/components/EventCard";
import FollowButton from "@/components/FollowButton";

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  createdAt?: Date;
  eventCount?: number;
}

interface EventItem {
  id: string;
  title: string;
  location: string;
  images: string[];
  ownerId: string;
  eventType: string; // Ensure this is present and correct
  createdAt: any;
}

interface UserListItemProps {
  userProfile: UserProfile;
}

function UserListItem({ userProfile }: UserListItemProps) {
  const router = useRouter();
  return (
    <div
      className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
      onClick={() => router.push(`/profile/${userProfile.uid}`)}
    >
      <img
        src={userProfile.photoURL || "/default-avatar.png"}
        alt={userProfile.displayName}
        className="w-10 h-10 rounded-full object-cover"
      />
      <span className="font-medium text-gray-800">{userProfile.displayName}</span>
    </div>
  );
}


export default function UserProfilePage() {
  const router = useRouter();
  const { uid } = useParams<{ uid: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<EventItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [loadingFollowData, setLoadingFollowData] = useState(true);


  const isOwner = currentUser?.uid === uid;


  // Fetch User Profile Data
  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          let fetchedCreatedAt: Date | undefined;
          if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
            fetchedCreatedAt = userData.createdAt.toDate();
          } else if (typeof userData.createdAt === 'string') {
            try {
                fetchedCreatedAt = new Date(userData.createdAt);
                if (isNaN(fetchedCreatedAt.getTime())) {
                    fetchedCreatedAt = undefined;
                }
            } catch (parseError) {
                console.error("Error parsing createdAt string to Date:", parseError);
                fetchedCreatedAt = undefined;
            }
          } else if (userData.createdAt instanceof Date) {
              fetchedCreatedAt = userData.createdAt;
          } else {
              fetchedCreatedAt = undefined;
          }


          setProfile({
            uid: userSnap.id,
            displayName: userData.displayName || "Unknown User",
            photoURL: userData.photoURL,
            bio: userData.bio,
            createdAt: fetchedCreatedAt,
            eventCount: userData.eventCount || 0,
          });
        } else {
          setProfileError("User profile not found.");
          setProfile(null);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setProfileError("Failed to load user profile.");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [uid]);


  // Fetch User Events
  useEffect(() => {
    if (!uid) return;

    const fetchUserEvents = async () => {
      setLoadingEvents(true);
      const allUserEvents: EventItem[] = [];
      const eventTypes = ["weddings", "birthdays", "babyshowers"];

      try {
        for (const type of eventTypes) {
          const q = query(
            collection(db, type),
            where("ownerId", "==", uid),
            orderBy("createdAt", "desc")
          );
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            allUserEvents.push({
              id: doc.id,
              title: doc.data().title,
              location: doc.data().location,
              images: doc.data().images || [],
              ownerId: doc.data().ownerId || "",
              eventType: type, // Ensure eventType is always included here
              createdAt: doc.data().createdAt,
            });
          });
        }
        allUserEvents.sort((a, b) => {
          const dateA = (a.createdAt instanceof Timestamp) ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(0));
          const dateB = (b.createdAt instanceof Timestamp) ? b.createdAt.toDate() : (b.createdAt instanceof Date ? b.createdAt : new Date(0));
          return dateB.getTime() - dateA.getTime();
        });
        setUserEvents(allUserEvents);
      } catch (error) {
        console.error("Error fetching user events:", error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchUserEvents();
  }, [uid]);


  const fetchFollowData = useCallback(async () => {
    setLoadingFollowData(true);
    try {
      const followersSnap = await getDocs(collection(db, "users", uid, "followers"));
      setFollowersCount(followersSnap.size);
      const fetchedFollowersUids = followersSnap.docs.map(doc => doc.id);

      const followingSnap = await getDocs(collection(db, "users", uid, "following"));
      setFollowingCount(followingSnap.size);
      const fetchedFollowingUids = followingSnap.docs.map(doc => doc.id);

      if (isOwner) {
        const fetchDetailedProfiles = async (uids: string[]): Promise<UserProfile[]> => {
          const profiles: UserProfile[] = [];
          const profilePromises = uids.map(id => getDoc(doc(db, "users", id)));
          const profileSnaps = await Promise.all(profilePromises);

          profileSnaps.forEach(userDocSnap => {
            if (userDocSnap.exists()) {
              const profileData = userDocSnap.data();
              let profileCreatedAt: Date | undefined;
              if (profileData.createdAt && typeof profileData.createdAt.toDate === 'function') {
                  profileCreatedAt = profileData.createdAt.toDate();
              } else if (typeof profileData.createdAt === 'string') {
                  try {
                      profileCreatedAt = new Date(profileData.createdAt);
                      if (isNaN(profileCreatedAt.getTime())) profileCreatedAt = undefined;
                  } catch (e) { profileCreatedAt = undefined; }
              } else if (profileData.createdAt instanceof Date) {
                  profileCreatedAt = profileData.createdAt;
              }

              profiles.push({
                  uid: userDocSnap.id,
                  displayName: profileData.displayName || "Unknown User",
                  photoURL: profileData.photoURL,
                  bio: profileData.bio,
                  createdAt: profileCreatedAt,
                  eventCount: profileData.eventCount || 0,
              });
            }
          });
          return profiles;
        };

        setFollowersList(await fetchDetailedProfiles(fetchedFollowersUids));
        setFollowingList(await fetchDetailedProfiles(fetchedFollowingUids));
      } else {
        setFollowersList([]);
        setFollowingList([]);
      }

    } catch (error) {
      console.error("Error fetching follow data:", error);
    } finally {
      setLoadingFollowData(false);
    }
  }, [uid, isOwner]);

  useEffect(() => {
    if (!uid) return;
    fetchFollowData();
  }, [uid, fetchFollowData]);


  const handleFollowChange = (newStatus: boolean) => {
    if (newStatus) {
      setFollowersCount(prev => prev + 1);
    } else {
      setFollowersCount(prev => Math.max(0, prev - 1));
    }
  };


  if (loadingProfile || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
        </svg>
        Loading profile...
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="text-center p-6 text-red-600">
        <p>{profileError}</p>
        <p>Please ensure the UID in the URL is correct.</p>
      </div>
    );
  }

  if (!profile) {
    return (
        <div className="text-center p-6 text-gray-600">
            <p>No profile data found for this user.</p>
        </div>
    );
  }

  const isCurrentUserProfile = currentUser?.uid === uid;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-lg rounded-xl p-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
        <div className="flex-shrink-0">
          <img
            src={profile.photoURL || "/default-avatar.png"} // Provide a default avatar
            alt={`${profile.displayName}'s profile`}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-rose-500"
          />
        </div>
        <div className="text-center md:text-left flex-grow">
          <h1 className="text-3xl font-bold text-rose-700">{profile.displayName}</h1>
          {profile.bio && <p className="text-gray-600 mt-2 italic">"{profile.bio}"</p>}
          <p className="text-sm text-gray-500 mt-1">
            Joined: {profile.createdAt ? profile.createdAt.toLocaleDateString() : "N/A"}
          </p>
          <p className="text-sm text-gray-500">
            Events Created: {profile.eventCount !== undefined ? profile.eventCount : "..."}
          </p>

          {!loadingFollowData && (
            <div className="flex justify-center md:justify-start space-x-4 mt-2">
              <p className="text-sm text-gray-700 font-semibold">{followersCount} Followers</p>
              <p className="text-sm text-gray-700 font-semibold">{followingCount} Following</p>
            </div>
          )}

          {!isCurrentUserProfile && currentUser && (
            <div className="mt-4">
              <FollowButton
                targetUserId={uid}
                targetUserDisplayName={profile.displayName}
                onFollowChange={handleFollowChange}
              />
            </div>
          )}

          {isCurrentUserProfile && (
            <div className="mt-4">
              <button
                onClick={() => router.push(`/profile/${uid}/edit`)}
                className="bg-purple-500 text-white px-5 py-2 rounded-full hover:bg-purple-600 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {isOwner && !loadingFollowData && (
        <section className="space-y-6 bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold text-rose-600">Your Network</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-3">People Following You ({followersList.length})</h3>
              {followersList.length === 0 ? (
                <p className="text-gray-400 italic">No one is following you yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {followersList.map(follower => (
                    <UserListItem key={follower.uid} userProfile={follower} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-3">People You Follow ({followingList.length})</h3>
              {followingList.length === 0 ? (
                <p className="text-gray-400 italic">You are not following anyone yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {followingList.map(followed => (
                    <UserListItem key={followed.uid} userProfile={followed} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-rose-600">
          {isOwner ? "Your Events" : `${profile.displayName}'s Events`}
        </h2>
        {loadingEvents ? (
          <div className="flex items-center space-x-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z" />
            </svg>
            <span className="italic">Loading events...</span>
          </div>
        ) : userEvents.length === 0 ? (
          <p className="text-gray-400 italic">
            {isOwner ? "You haven't created any events yet." : `${profile.displayName} hasn't created any events yet.`}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userEvents.map((event) => (
              <EventCard
                key={event.id}
                title={event.title}
                location={event.location}
                imageUrl={event.images[0] || "https://via.placeholder.com/400x250?text=No+Image"}
                onViewEvent={() => router.push(`/events/${event.eventType}/${event.id}`)}
                eventId={event.id}
                mediaUrls={event.images}
                ownerId={event.ownerId}
                eventType={event.eventType} // <<< Pass eventType here
                allowDelete={isOwner} // <<< Pass allowDelete based on isOwner
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}