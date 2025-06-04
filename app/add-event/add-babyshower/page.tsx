// app/add-event/add-babyshower/page.tsx
"use client"; // <-- Add this line

import AddEventForm from "@/components/AddEventForm";

export default function AddBabyShowerPage() {
  return (
    <AddEventForm
      eventType="babyshowers"
      titleLabel="Baby Shower Title"
      coupleOrPersonLabel="Parent(s) or Baby's Name"
    />
  );
}