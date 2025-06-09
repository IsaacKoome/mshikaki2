import EventDetailPage from "@/components/EventDetailPage";

export default function WeddingsEventPage({ params }: { params: { id: string } }) {
  return <EventDetailPage id={params.id} collectionName="weddings" />;
}
