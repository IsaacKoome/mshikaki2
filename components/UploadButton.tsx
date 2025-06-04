"use client";

import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export function EventMediaUploader() {
  return (
    <UploadButton<OurFileRouter, "eventMedia">
      endpoint="eventMedia"
      onClientUploadComplete={(res) => {
        console.log("Uploaded:", res);
        // You can save `res[0].url` to your database
        alert("Upload successful!");
      }}
      onUploadError={(error: Error) => {
        alert(`Upload failed: ${error.message}`);
      }}
    />
  );
}
