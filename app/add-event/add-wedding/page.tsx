// app/add-event/add-wedding/page.tsx
"use client"; // <-- Add this line

import AddEventForm from "@/components/AddEventForm";

export default function AddWeddingPage() {
  return (
    <AddEventForm
      eventType="weddings"
      titleLabel="Wedding Title"
      coupleOrPersonLabel="Couple's Names"
    />
  );
}