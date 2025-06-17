// app/profile/[uid]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage"; // Added deleteObject for old photo cleanup
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image'; // For Next.js Image component
import { Toaster, toast } from "sonner"; // For Sonner toasts
import { Button } from "@/components/ui/button"; // Shadcn Button
import { Input } from "@/components/ui/input"; // Shadcn Input
import { Textarea } from "@/components/ui/textarea"; // Shadcn Textarea
import { Label } from "@/components/ui/label"; // Shadcn Label
import { Loader2, UserRoundIcon, ImagePlusIcon, SaveIcon, ArrowLeftIcon } from "lucide-react"; // Lucide icons

// Interface for user profile data (consistent with what's stored in Firestore 'users' collection)
interface UserProfileData {
    uid: string;
    displayName: string;
    photoURL?: string;
    bio?: string;
    createdAt?: Timestamp; // Assuming createdAt is stored as Timestamp
}

export default function EditProfilePage() {
    const { uid } = useParams<{ uid: string }>();
    const { user, loading: authLoading } = useAuth(); // Get current authenticated user
    const router = useRouter();

    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null);
    const [previewPhotoURL, setPreviewPhotoURL] = useState<string | null>(null); // For immediate visual feedback of new image
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if the current logged-in user is the owner of this profile
    const isOwner = user?.uid === uid;

    // Redirect if not authenticated or not authorized
    useEffect(() => {
        if (!authLoading && !user) {
            toast.error("Authentication required.", { description: "You must be logged in to edit a profile." });
            router.replace("/login"); // Redirect to login if not authenticated
        } else if (!authLoading && user && user.uid !== uid) {
            toast.error("Unauthorized access.", { description: "You can only edit your own profile." });
            router.replace(`/users/${user.uid}`); // Redirect to their own profile if trying to edit someone else's
        }
    }, [user, authLoading, uid, router]);

    // Fetch existing profile data to pre-fill the form
    useEffect(() => {
        if (!uid || !isOwner) return; // Only fetch if we have a UID and are the owner

        const fetchProfile = async () => {
            setLoadingProfile(true);
            setError(null);
            try {
                const userRef = doc(db, "users", uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data() as UserProfileData;
                    setDisplayName(data.displayName || "");
                    setBio(data.bio || "");
                    setCurrentPhotoURL(data.photoURL || '/default-avatar.png'); // Set current URL for display
                    setPreviewPhotoURL(data.photoURL || '/default-avatar.png'); // Set preview to current initially
                } else {
                    // If no user document exists, pre-fill with current authenticated user's data
                    // This scenario is for new users who haven't created a profile doc yet
                    if (user) {
                        setDisplayName(user.displayName || user.email?.split('@')[0] || "");
                        setBio("");
                        setCurrentPhotoURL(user.photoURL || '/default-avatar.png');
                        setPreviewPhotoURL(user.photoURL || '/default-avatar.png');
                    } else {
                        setError("User profile not found."); // Should ideally not happen if user is logged in
                    }
                }
            } catch (err) {
                console.error("Error fetching profile for editing:", err);
                setError("Failed to load profile data. Please check your internet connection and try again.");
            } finally {
                setLoadingProfile(false);
            }
        };

        if (user) { // Only fetch if user object is available (implies auth is ready)
            fetchProfile();
        }
    }, [uid, isOwner, user]); // Depend on user to trigger fetch once auth is ready

    // Handle file input change for photo preview
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Basic file type and size validation
            if (!file.type.startsWith('image/')) {
                toast.error("Invalid file type", { description: "Please upload an image file." });
                setPhotoFile(null);
                setPreviewPhotoURL(currentPhotoURL);
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error("File too large", { description: "Please upload an image smaller than 5MB." });
                setPhotoFile(null);
                setPreviewPhotoURL(currentPhotoURL);
                return;
            }

            setPhotoFile(file);
            setPreviewPhotoURL(URL.createObjectURL(file)); // Create a URL for local preview
        } else {
            setPhotoFile(null);
            setPreviewPhotoURL(currentPhotoURL); // Revert to current if no file selected
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        if (!user || user.uid !== uid) {
            toast.error("Unauthorized", { description: "You can only edit your own profile." });
            setIsSubmitting(false);
            return;
        }
        if (!displayName.trim()) {
            toast.error("Display Name Required", { description: "Please enter your display name." });
            setIsSubmitting(false);
            return;
        }


        try {
            let newPhotoURL = currentPhotoURL;

            // 1. Upload new photo if selected
            if (photoFile) {
                // If there's an old photo and it's not the default avatar, try to delete it from storage
                if (currentPhotoURL && !currentPhotoURL.includes('/default-avatar.png') && currentPhotoURL.startsWith('https://firebasestorage.googleapis.com/')) {
                    try {
                        // Extract path from the full URL. E.g., .../profilePics%2Fuser_id%2Fphoto_name?alt...
                        const pathMatch = currentPhotoURL.match(/profilePics%2F([^%]+)%2F([^?]+)/);
                        if (pathMatch && pathMatch[1] === user.uid) { // Ensure it's user's own photo
                           const oldPhotoPath = `profilePics/${pathMatch[1]}/${decodeURIComponent(pathMatch[2])}`;
                           const oldPhotoRef = ref(storage, oldPhotoPath);
                           await deleteObject(oldPhotoRef);
                           console.log("Old profile photo deleted successfully:", oldPhotoPath);
                        } else {
                           console.warn("Old photo URL not recognized or not owned by current user for deletion:", currentPhotoURL);
                        }
                    } catch (deleteError) {
                        console.warn("Could not delete old profile photo (might not exist or permission issue):", deleteError);
                        // Do not block submission for delete error
                    }
                }

                const photoExtension = photoFile.name.split('.').pop();
                const photoName = `${user.uid}-${uuidv4()}.${photoExtension}`; // Ensures unique name for new upload
                const photoRef = ref(storage, `profilePics/${user.uid}/${photoName}`);
                await uploadBytes(photoRef, photoFile);
                newPhotoURL = await getDownloadURL(photoRef);
                console.log("New photo uploaded:", newPhotoURL);
            }

            // 2. Update user document in Firestore
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                displayName: displayName.trim(),
                bio: bio.trim(),
                photoURL: newPhotoURL,
                // createdAt field should ideally not be updated here
            });

            toast.success("Profile Updated!", { description: "Your profile has been successfully saved." });
            
            // Redirect back to the user's profile page after a short delay for toast to be seen
            setTimeout(() => {
                router.push(`/users/${user.uid}`);
            }, 1500);

        } catch (err) {
            console.error("Error updating profile:", err);
            const errorMessage = `Failed to update profile: ${err instanceof Error ? err.message : String(err)}`;
            setError(errorMessage); // Set error state for display
            toast.error("Profile Update Failed", { description: "Please try again. " + (err instanceof Error ? err.message : '') });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Conditional rendering for loading, error, and unauthorized states
    if (authLoading || loadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                <p className="ml-4 text-lg text-gray-600">Loading profile data...</p>
            </div>
        );
    }

    if (error) { // Display a more prominent error if fetching failed
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 text-red-700 p-6">
                <p className="text-xl font-semibold mb-4">Error Loading Profile</p>
                <p className="text-center">{error}</p>
                <Button onClick={() => router.back()} className="mt-6 bg-red-600 hover:bg-red-700 text-white">Go Back</Button>
            </div>
        );
    }

    // This case should ideally be caught by the useEffect redirect, but as a safeguard
    if (!isOwner) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 text-red-700 p-6">
                <p className="text-xl font-semibold mb-4">Access Denied</p>
                <p className="text-center">You are not authorized to edit this profile.</p>
                <Button onClick={() => router.replace(user ? `/users/${user.uid}` : '/login')} className="mt-6 bg-red-600 hover:bg-red-700 text-white">
                  {user ? "Go to My Profile" : "Login"}
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <main className="w-full max-w-2xl mx-auto p-6 sm:p-8 md:p-10 bg-white shadow-2xl rounded-3xl border border-blue-100 space-y-7 sm:space-y-8 animate-fade-in">
                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-base transition-colors py-2 px-4 rounded-lg border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    Back to Profile
                </button>

                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-800 mb-6 flex items-center justify-center gap-3">
                    <UserRoundIcon className="w-8 h-8 text-indigo-600" /> Edit Your Profile
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
                    {/* Profile Picture Section */}
                    <div className="space-y-4 text-center">
                        <Label className="text-lg font-semibold text-gray-800 mb-2 block">Profile Picture</Label>
                        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-blue-400 shadow-md">
                            <Image
                                src={previewPhotoURL || '/default-avatar.png'} // Use preview URL
                                alt="Profile Preview"
                                fill
                                className="object-cover"
                                sizes="128px"
                            />
                        </div>
                        <div className="mt-4">
                            <label htmlFor="photoUpload" className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-full cursor-pointer hover:bg-blue-600 transition-colors shadow-md">
                                <ImagePlusIcon className="w-4 h-4 mr-2" /> Change Photo
                            </label>
                            <input
                                id="photoUpload"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                        </div>
                        {photoFile && <p className="text-sm text-gray-500 mt-2">New photo selected: {photoFile.name}</p>}
                    </div>

                    {/* Display Name */}
                    <div>
                        <Label htmlFor="displayName" className="text-sm font-medium text-gray-700 mb-1 block">Display Name</Label>
                        <Input
                            id="displayName"
                            placeholder="Your Name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <Label htmlFor="bio" className="text-sm font-medium text-gray-700 mb-1 block">Bio (Optional)</Label>
                        <Textarea
                            id="bio"
                            placeholder="Tell us a little about yourself..."
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={4}
                            className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 sm:py-4 text-lg sm:text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-[1.01] active:scale-95"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Saving Profile...
                            </>
                        ) : (
                            <>
                                <SaveIcon className="w-5 h-5 mr-2" /> Save Changes
                            </>
                        )}
                    </Button>
                </form>
            </main>
            <Toaster richColors /> {/* Add Toaster component here */}
        </div>
    );
}
