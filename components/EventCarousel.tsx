import EventCard from "./EventCard";

type Props = {
  title: string;
  events: {
    id: string;
    title: string;
    date: string;
    image: string;
  }[];
};

export default function EventCarousel({ title, events }: Props) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">
        {events.map((event) => (
          <EventCard
            key={event.id}
            title={event.title}
            date={event.date}
            image={event.image}
          />
        ))}
      </div>
    </section>
  );
}
