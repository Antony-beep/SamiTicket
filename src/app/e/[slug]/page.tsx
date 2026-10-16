import Link from "next/link";
import Image from 'next/image';
import { notFound } from "next/navigation";
import { AuthControl } from "@/components/auth/auth-control";
import { BuyerRegistration } from "@/components/buyer-registration";
import { formatCurrency, formatEventDate } from "@/lib/events";
import { publicEvents } from "@/lib/server/data";
import { connection } from 'next/server';
import { WeatherPanel } from '@/components/weather-panel';
import { LocationMap } from '@/components/location-map';

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  await connection();
  const { slug } = await params;
  const event = (await publicEvents(slug))[0];
  if (!event) notFound();


  return (
    <main>
      <header className="site-header container">
        <Link className="brand" href="/">Sami<span>Ticket</span></Link>
        <div className="header-actions">
          <Link className="button button-secondary" href="/">← Volver a eventos</Link>
          <AuthControl />
        </div>
      </header>

      <section className="event-hero">
        <div className="container">
          <p className="eyebrow">{event.category}</p>
          <h1>{event.title}</h1>
          <p>{formatEventDate(event.date)} · {event.startTime}</p>
        </div>
      </section>

      <section className="container event-layout">
        <article className="event-details">
          {event.coverLargeUrl ? <Image className="event-poster" src={event.coverLargeUrl} alt={`Afiche completo de ${event.title}`} width={1600} height={1600} unoptimized loading="eager" /> : <div className="event-visual" />}
          <section>
            <h2>Sobre el evento</h2>
            <p>{event.description}</p>
          </section>
          <section className="detail-grid">
            <div><span>Fecha y hora</span><strong>{formatEventDate(event.date)} · {event.startTime}</strong></div>
            <div><span>Lugar</span><strong>{event.venue}<br />{event.address}</strong></div>
            <div><span>Entradas disponibles</span><strong>{event.available} de {event.capacity}</strong></div>
          </section>
          <section><h2>Cómo llegar</h2>{event.reference && <p>Referencia: {event.reference}</p>}
            <LocationMap latitude={event.latitude} longitude={event.longitude} />
            <a className="button button-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`} target="_blank" rel="noreferrer">Cómo llegar en Google Maps</a>
          </section>
          <WeatherPanel latitude={event.latitude} longitude={event.longitude} date={event.date} time={event.startTime} outdoor={event.outdoor} />
        </article>
        <aside>
          <div className="price-card"><span>Entrada general</span><strong>{formatCurrency(event.priceCents)}</strong></div>
          <BuyerRegistration eventId={event.id} available={event.available} demoEnabled={process.env.DEMO_PAYMENTS_ENABLED === 'true'} />
        </aside>
      </section>
    </main>
  );
}
