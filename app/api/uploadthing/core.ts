// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  eventMedia: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    video: { maxFileSize: "16MB", maxFileCount: 1 }
  })
  .middleware(async (_req) => { // <-- Changed 'req' to '_req'
    // Add any authentication logic here
    // Example: const authToken = _req.headers.get("authorization");
    return {};
  })
  .onUploadComplete(async ({ file }) => {
    console.log("Upload completed", file);
    return { url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;