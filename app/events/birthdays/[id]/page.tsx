import EventDetailPage from "@/components/EventDetailPage";

export default function BirthdayEventPage({ params }: { params: { id: string } }) {
  return <EventDetailPage id={params.id} collectionName="birthdays" />;
}
