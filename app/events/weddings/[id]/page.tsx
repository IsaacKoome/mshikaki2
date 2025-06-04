import EventDetailPage from "@/components/EventDetailPage";

export default function WeddingEventPage({ params }: { params: { id: string } }) {
  return <EventDetailPage id={params.id} collectionName="weddings" />;
}
