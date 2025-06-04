import EventDetailPage from "@/components/EventDetailPage";

export default function BabyShowerEventPage({ params }: { params: { id: string } }) {
  return <EventDetailPage id={params.id} collectionName="babyshowers" />;
}
