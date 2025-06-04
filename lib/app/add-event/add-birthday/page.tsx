import AddEventForm from "@/components/AddEventForm";

export default function AddBirthdayPage() {
  return (
    <AddEventForm
      eventType="birthdays"
      titleLabel="Birthday Title"
      coupleOrPersonLabel="Birthday Person's Name"
    />
  );
}
