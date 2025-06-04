// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  eventMedia: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    video: { maxFileSize: "16MB", maxFileCount: 1 }
  })
  .middleware(async (req) => {
    // Add any authentication logic here
    return {};
  })
  .onUploadComplete(async ({ file }) => {
    console.log("Upload completed", file);
    return { url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;