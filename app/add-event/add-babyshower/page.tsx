"use client";

import AddEventForm from "@/components/AddEventForm";
import { eventTypes } from "@/data/eventTypes";

export default function AddBabyShowerPage() {
  const config = eventTypes["babyshowers"];
  return (
    <AddEventForm
      eventType="babyshowers"
      titleLabel={config.titleLabel}
      coupleOrPersonLabel={config.coupleOrPersonLabel}
    />
  );
}
