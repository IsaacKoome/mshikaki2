"use client";

import AddEventForm from "@/components/AddEventForm";
import { eventTypes } from "@/data/eventTypes";

export default function AddWeddingPage() {
  const config = eventTypes["weddings"];
  return (
    <AddEventForm
      eventType="weddings"
      titleLabel={config.titleLabel}
      coupleOrPersonLabel={config.coupleOrPersonLabel}
    />
  );
}
