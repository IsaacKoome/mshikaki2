"use client";
import { UploadDropzone } from "@uploadthing/react";
import { OurFileRouter } from "@/app/api/uploadthing/core";
import Image from "next/image"; // Changed from img to Next.js Image

interface EventMediaUploaderProps {
  onUploadComplete: (url: string) => void;
}

export const EventMediaUploader = ({ onUploadComplete }: EventMediaUploaderProps) => {
  return (
    <div className="space-y-4">
      <UploadDropzone<OurFileRouter, "eventMedia">
        endpoint="eventMedia"
        onClientUploadComplete={(res) => {
          if (res?.[0]?.url) {
            onUploadComplete(res[0].url);
          }
        }}
        appearance={{
          label: "text-black hover:text-gray-800",
          uploadIcon: "text-gray-500",
        }}
      />
    </div>
  );
};