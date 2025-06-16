// components/event-sections/EventMediaSection.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { storage, db } from "@/lib/firebase";
import { ImageIcon, VideoIcon, UploadCloudIcon, Loader2, InfoIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";


interface EventData {
  title: string;
  images: string[];
  videos?: string[];
  ownerId?: string;
  [key: string]: any;
}

interface CurrentUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
}

interface EventMediaSectionProps {
  eventId: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
  eventData: EventData;
  currentUser: CurrentUser | null;
}

export default function EventMediaSection({ eventId, collectionName, eventData, currentUser }: EventMediaSectionProps) {
  const [newImages, setNewImages] = useState<FileList | null>(null);
  const [newVideos, setNewVideos] = useState<FileList | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadMediaMessage, setUploadMediaMessage] = useState<string | null>(null);
  const [showUploadMedia, setShowUploadMedia] = useState(false);

  const allMediaUrls = [
    ...(eventData.images || []),
    ...(eventData.videos || []),
  ];

  const isOwner = currentUser?.uid === eventData.ownerId;

  const uploadFiles = async (files: FileList | File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fileRef = ref(storage, `${folder}/${uuidv4()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      urls.push(url);
    }
    return urls;
  };

  const handleUploadMoreMedia = async () => {
    if (!currentUser || currentUser.uid !== eventData.ownerId) {
      alert("You are not authorized to upload media for this event.");
      return;
    }

    if (!newImages && !newVideos) {
      setUploadMediaMessage("Please select at least one image or video to upload.");
      return;
    }

    setIsUploadingMedia(true);
    setUploadMediaMessage("Uploading media...");

    try {
      const imageUrls = newImages ? await uploadFiles(newImages, "images") : [];
      const videoUrls = newVideos ? await uploadFiles(newVideos, "videos") : [];

      const eventRef = doc(db, collectionName, eventId);
      await updateDoc(eventRef, {
        images: arrayUnion(...imageUrls),
        videos: arrayUnion(...videoUrls),
      });

      setUploadMediaMessage("Media uploaded successfully! Reloading to show new content...");
      setNewImages(null);
      setNewVideos(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Error uploading new media:", error);
      setUploadMediaMessage(`Failed to upload media: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add More Media Section (Only for Owner) */}
      {isOwner && (
          <section className="bg-blue-50 shadow-inner p-6 rounded-2xl border border-blue-200 space-y-4">
              <Collapsible open={showUploadMedia} onOpenChange={setShowUploadMedia}>
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
                          <UploadCloudIcon className="w-6 h-6" /> Upload More Photos & Videos
                      </div>
                      <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-blue-700 hover:text-blue-900">
                              <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showUploadMedia ? "rotate-180" : ""}`} />
                          </Button>
                      </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="mt-4 space-y-3">
                      <div>
                          <label htmlFor="newImagesUpload" className="block text-gray-700 font-medium mb-1 flex items-center gap-2">
                              <ImageIcon className="w-5 h-5 text-blue-600" /> Select New Images
                          </label>
                          <input
                              id="newImagesUpload"
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => setNewImages(e.target.files)}
                              className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-100 file:text-blue-700
                                  hover:file:bg-blue-200"
                              disabled={isUploadingMedia}
                          />
                      </div>
                      <div>
                          <label htmlFor="newVideosUpload" className="block text-gray-700 font-medium mb-1 flex items-center gap-2">
                              <VideoIcon className="w-5 h-5 text-blue-600" /> Select New Videos
                          </label>
                          <input
                              id="newVideosUpload"
                              type="file"
                              accept="video/*"
                              multiple
                              onChange={(e) => setNewVideos(e.target.files)}
                              className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-100 file:text-blue-700
                                  hover:file:bg-blue-200"
                              disabled={isUploadingMedia}
                          />
                      </div>

                      {uploadMediaMessage && (
                          <p className="text-sm text-center font-medium
                              p-2 rounded-lg
                              bg-yellow-100 text-yellow-800 border border-yellow-200">
                              {uploadMediaMessage}
                          </p>
                      )}

                      <Button
                          onClick={handleUploadMoreMedia}
                          className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold rounded-lg shadow-md flex items-center justify-center gap-2"
                          disabled={isUploadingMedia || (!newImages && !newVideos)}
                      >
                          {isUploadingMedia ? (
                              <>
                                  <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
                                  </svg>
                                  Uploading...
                              </>
                          ) : (
                              <>
                                  <UploadCloudIcon className="w-5 h-5" />
                                  Upload Media
                              </>
                          )}
                      </Button>
                  </CollapsibleContent>
              </Collapsible>
          </section>
      )}

      {/* Photos & Videos Gallery */}
      <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-rose-700 mb-5 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-rose-600" />
            All Photos & Videos
        </h2>
        {allMediaUrls.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">No photos or videos uploaded for this event yet.</p>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allMediaUrls.map((url, index) => {
                    const isVideo = url.includes('/videos/') || url.match(/\.(mp4|mov|avi|webm|ogg)$/i);
                    return (
                        <div key={`media-${index}`} className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md border border-gray-200 bg-black flex items-center justify-center">
                            {isVideo ? (
                                <video
                                    src={url}
                                    controls
                                    className="w-full h-full object-contain"
                                    aria-label={`Event Video ${index + 1}`}
                                    preload="metadata"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <Image
                                    src={url}
                                    alt={`Event Image ${index + 1}`}
                                    fill
                                    className="object-cover transition-transform duration-300 hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </section>
    </div>
  );
}
