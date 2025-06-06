"use client";

import AddEventForm from "@/components/AddEventForm";
import { eventTypes } from "@/data/eventTypes";

export default function AddBirthdayPage() {
  const config = eventTypes["birthdays"];
  return (
    <AddEventForm
      eventType="birthdays"
      titleLabel={config.titleLabel}
      coupleOrPersonLabel={config.coupleOrPersonLabel}
    />
  );
}
