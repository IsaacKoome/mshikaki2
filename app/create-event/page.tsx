// app/create-event/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  CalendarIcon,
  Loader2,
  PartyPopperIcon,
  HandshakeIcon,
  BabyIcon,
  ChurchIcon,
  DollarSignIcon,
  FileQuestionIcon,
  MegaphoneIcon,
  ImagePlusIcon,
  VideoIcon
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "@/lib/auth";

// Define the EventData interface here and ensure consistency with EventDetailPage
interface EventData {
  title: string;
  location: string;
  images: string[];
  videos?: string[];
  goal: number;
  story?: string;
  date?: string;
  contributionNote?: string;
  beneficiaryPhone?: string;
  ownerId: string;
  createdAt: Timestamp;
  eventCategory: 'wedding' | 'birthday' | 'babyshower' | 'party' | 'concert' | 'community' | 'church' | 'fundraiser' | 'other';
  isPublic: boolean;
}

export default function CreateEventPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<FileList | null>(null);
  const [videos, setVideos] = useState<FileList | null>(null);
  const [goal, setGoal] = useState<number | "">(0);
  const [story, setStory] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [contributionNote, setContributionNote] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [collectionName, setCollectionName] = useState<"weddings" | "birthdays" | "babyshowers">("weddings");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [eventCategory, setEventCategory] = useState<EventData['eventCategory']>('other');
  const [isPublic, setIsPublic] = useState(true);


  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Authentication Required", { description: "Please sign in to create an event." });
      return;
    }

    if (!title || !location || !goal || !date || !beneficiaryPhone || !collectionName || !eventCategory) {
      toast.error("Missing Information", { description: "Please fill in all required fields." });
      return;
    }
    if (Number(goal) <= 0) {
      toast.error("Invalid Goal", { description: "Contribution goal must be a positive number." });
      return;
    }
    if (!images || images.length === 0) {
      toast.error("Missing Images", { description: "Please upload at least one image for the event." });
      return;
    }

    setIsSubmitting(true);
    let imageUrls: string[] = [];
    let videoUrls: string[] = [];

    try {
      // Upload Images
      if (images) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const imageRef = ref(storage, `event_images/${uuidv4()}-${image.name}`);
          await uploadBytes(imageRef, image);
          const url = await getDownloadURL(imageRef);
          imageUrls.push(url);
        }
      }

      // Upload Videos
      if (videos) {
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          const videoRef = ref(storage, `event_videos/${uuidv4()}-${video.name}`);
          await uploadBytes(videoRef, video);
          const url = await getDownloadURL(videoRef);
          videoUrls.push(url);
        }
      }

      // Add event to Firestore
      const newEvent: EventData = {
        title,
        location,
        images: imageUrls,
        videos: videoUrls,
        goal: Number(goal),
        raised: 0,
        story,
        date: format(date, "PPP"),
        contributionNote,
        beneficiaryPhone,
        ownerId: user.uid,
        createdAt: Timestamp.now(),
        eventCategory,
        isPublic,
      };

      const docRef = await addDoc(collection(db, collectionName), newEvent);

      toast.success("Event Created Successfully!", {
        description: `${title} has been listed. You will be redirected shortly.`,
      });

      setTimeout(() => {
        router.push(`/events/${collectionName}/${docRef.id}`);
      }, 1500);

    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Event Creation Failed", {
        description: `There was an error: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Restored the previous gradient background
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <main className="w-full max-w-3xl mx-auto p-6 sm:p-8 md:p-10 bg-white shadow-2xl rounded-3xl border border-purple-100 space-y-7 sm:space-y-8 animate-fade-in">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-800 mb-6 flex items-center justify-center gap-3">
          <MegaphoneIcon className="w-8 h-8 text-indigo-600" /> Create New Event
        </h1>

        <form onSubmit={handleCreateEvent} className="space-y-6 sm:space-y-7">
          {/* Section for Event Basics */}
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-700 border-b pb-2 mb-4 border-purple-200">
              Basic Event Details
            </h2>
            <div>
              <Label htmlFor="title" className="text-sm font-medium text-gray-700 mb-1 block">Event Title</Label>
              <Input
                id="title"
                placeholder="e.g., John & Jane's Wedding Celebration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-1 block">Event Location</Label>
              <Input
                id="location"
                placeholder="e.g., Nairobi, Kenya"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Section for Category & Date */}
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-700 border-b pb-2 mb-4 border-purple-200">
              Categorization & Timing
            </h2>
            <div>
              <Label htmlFor="eventCategory" className="text-sm font-medium text-gray-700 mb-1 block">Event Category</Label>
              <Select value={eventCategory} onValueChange={(value: EventData['eventCategory']) => setEventCategory(value)}>
                <SelectTrigger id="eventCategory" className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                  <SelectValue placeholder="Select Event Category" />
                </SelectTrigger>
                {/* Ensure z-index and position="popper" are kept for the dropdown content */}
                <SelectContent className="z-[99] bg-white rounded-lg shadow-lg border border-gray-200" position="popper">
                  <SelectItem value="wedding">Wedding <PartyPopperIcon className="inline-block ml-2 w-4 h-4 text-purple-500" /></SelectItem>
                  <SelectItem value="birthday">Birthday <BabyIcon className="inline-block ml-2 w-4 h-4 text-pink-500" /></SelectItem>
                  <SelectItem value="babyshower">Baby Shower <BabyIcon className="inline-block ml-2 w-4 h-4 text-blue-500" /></SelectItem>
                  <SelectItem value="party">Party <PartyPopperIcon className="inline-block ml-2 w-4 h-4 text-yellow-500" /></SelectItem>
                  <SelectItem value="concert">Concert <svg xmlns="http://www.w3.org/2000/svg" className="inline-block ml-2 w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14H8V8h2v8zm4 0h-2V8h2v8zm4-8h-2v8h2V8z"/></svg></SelectItem>
                  <SelectItem value="community">Community Gathering <HandshakeIcon className="inline-block ml-2 w-4 h-4 text-green-500" /></SelectItem>
                  <SelectItem value="church">Church Event <ChurchIcon className="inline-block ml-2 w-4 h-4 text-indigo-500" /></SelectItem>
                  <SelectItem value="fundraiser">Fundraiser <DollarSignIcon className="inline-block ml-2 w-4 h-4 text-orange-500" /></SelectItem>
                  <SelectItem value="other">Other <FileQuestionIcon className="inline-block ml-2 w-4 h-4 text-gray-500" /></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="collectionName" className="text-sm font-medium text-gray-700 mb-1 block">Internal Collection Type (for organizing)</Label>
              <Select value={collectionName} onValueChange={(value: "weddings" | "birthdays" | "babyshowers") => setCollectionName(value)}>
                <SelectTrigger id="collectionName" className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                  <SelectValue placeholder="Select Internal Type" />
                </SelectTrigger>
                {/* Ensure z-index and position="popper" are kept for the dropdown content */}
                <SelectContent className="z-[99] bg-white rounded-lg shadow-lg border border-gray-200" position="popper">
                  <SelectItem value="weddings">Wedding</SelectItem>
                  <SelectItem value="birthdays">Birthday</SelectItem>
                  <SelectItem value="babyshowers">Baby Shower</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">This helps organize your events internally in the database.</p>
            </div>

            <div>
              <Label htmlFor="eventDate" className="text-sm font-medium text-gray-700 mb-1 block">Event Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={`w-full justify-start text-left font-normal h-10 px-4 py-2 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all ${!date && "text-muted-foreground"}`}
                    id="eventDate"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white rounded-lg shadow-xl border border-gray-200 z-[99]">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Section for Financial & Description */}
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-700 border-b pb-2 mb-4 border-purple-200">
              Financial & Story
            </h2>
            <div>
              <Label htmlFor="goal" className="text-sm font-medium text-gray-700 mb-1 block">Contribution Goal (KES)</Label>
              <Input
                id="goal"
                type="number"
                placeholder="e.g., 50000"
                value={goal}
                onChange={(e) => setGoal(e.target.value === "" ? "" : Number(e.target.value))}
                required
                min="1"
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <Label htmlFor="beneficiaryPhone" className="text-sm font-medium text-gray-700 mb-1 block">Beneficiary M-Pesa Phone Number</Label>
              <Input
                id="beneficiaryPhone"
                type="tel"
                placeholder="e.g., 0712345678 (for receiving contributions)"
                value={beneficiaryPhone}
                onChange={(e) => setBeneficiaryPhone(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>
            <p className="text-xs text-gray-500 -mt-2">Ensure this is the M-Pesa number registered to receive payments.</p>

            <div>
              <Label htmlFor="story" className="text-sm font-medium text-gray-700 mb-1 block">Event Story / Description</Label>
              <Textarea
                id="story"
                placeholder="Tell us more about your event, its purpose, and what makes it special..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
                rows={5}
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <Label htmlFor="contributionNote" className="text-sm font-medium text-gray-700 mb-1 block">Note for Contributors (Optional)</Label>
              <Textarea
                id="contributionNote"
                placeholder="e.g., Thank you for supporting our dream wedding! Your contribution means the world to us."
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg px-4 py-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Section for Media Upload */}
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-700 border-b pb-2 mb-4 border-purple-200">
              Event Media
            </h2>
            <div>
              <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <ImagePlusIcon className="w-5 h-5 text-purple-500" /> Upload Event Images (Min. 1, Max. 5)
              </label>
              <input
                type="file"
                id="images"
                accept="image/*"
                multiple
                onChange={(e) => setImages(e.target.files)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100 transition-colors duration-200 cursor-pointer"
              />
               {images && images.length > 5 && (
                <p className="text-red-500 text-sm mt-1">You can upload a maximum of 5 images.</p>
              )}
          </div>

            <div>
              <label htmlFor="videos" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <VideoIcon className="w-5 h-5 text-purple-500" /> Upload Event Videos (Optional)
              </label>
              <input
                type="file"
                id="videos"
                accept="video/*"
                multiple
                onChange={(e) => setVideos(e.target.files)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100 transition-colors duration-200 cursor-pointer"
              />
            </div>
          </div>

          {/* Public Visibility Checkbox */}
          <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-xl border border-purple-200 shadow-sm">
            <Checkbox
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
              className="w-5 h-5 border-purple-400 text-purple-600 focus:ring-purple-500 focus:ring-offset-background"
            />
            <Label htmlFor="isPublic" className="text-base font-medium text-purple-800 leading-none cursor-pointer">
              Make this event publicly discoverable (uncheck to make private)
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 sm:py-4 text-lg sm:text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-[1.01] active:scale-95"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Event...
              </>
            ) : (
              "Create Event"
            )}
          </Button>
        </form>
      </main>
      <Toaster richColors />
    </div>
  );
}
