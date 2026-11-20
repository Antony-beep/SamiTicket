import Link from "next/link";
import Image from 'next/image';
import { notFound } from "next/navigation";
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { BuyerRegistration } from "@/components/buyer-registration";
import { formatCurrency, formatEventDate, googleCalendarUrl } from "@/lib/events";
import { formatUsdEstimate, getPenToUsdRate } from "@/lib/server/currency";
import { publicEvents } from "@/lib/server/data";
import { connection } from 'next/server';
import { WeatherPanel } from '@/components/weather-panel';
import { LocationMap } from '@/components/location-map';

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  await connection();
  const { slug } = await params;
  const [events, usdRate] = await Promise.all([publicEvents(slug), getPenToUsdRate()]);
  const event = events[0];
  if (!event) notFound();
  const usdEstimate = formatUsdEstimate(event.priceCents, usdRate);
  const gcalUrl = googleCalendarUrl({
    title: event.title,
    startsAt: event.date && event.startTime ? `${event.date}T${event.startTime}:00-05:00` : null,
    venue: event.venue,
    address: event.address,
    city: event.city,
    details: event.description,
  });

  return (
    <main className="event-page">
      <SiteHeader />

      <section className="event-hero">
        <div className="container">
          <Link className="event-back" href="/#eventos"><HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden="true" />Volver a la cartelera</Link>
          <div><Badge variant="outline">{event.category}</Badge></div>
          <h1>{event.title}</h1>
          <p>{formatEventDate(event.date)} · {event.startTime} · {event.city}</p>
        </div>
      </section>

      <section className="container event-layout">
        <article className="event-details">
          {event.coverLargeUrl ? (
            <Image
              className="event-poster"
              src={event.coverLargeUrl}
              alt={`Afiche oficial de ${event.title}`}
              width={1600}
              height={1600}
              unoptimized
              loading="eager"
            />
          ) : (
            <div className="event-visual" />
          )}

          <section>
            <h2>Sobre la fiesta</h2>
            <p>{event.description}</p>
          </section>

          <section className="detail-grid">
            <div>
              <span>Fecha y hora</span>
              <strong>{formatEventDate(event.date)} · {event.startTime}</strong>
            </div>
            <div>
              <span>Lugar</span>
              <strong>{event.venue}<br />{event.address}</strong>
            </div>
            <div>
              <span>Pases disponibles</span>
              <strong>{event.available} de {event.capacity}</strong>
            </div>
          </section>

          <section>
            <h2>Cómo llegar</h2>
            {event.reference && <p>Referencia local: {event.reference}</p>}
            <LocationMap latitude={event.latitude} longitude={event.longitude} />
            <a
              className="map-link"
              href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir ubicación en Google Maps <HugeiconsIcon icon={ArrowUpRight01Icon} size={18} aria-hidden="true" />
            </a>
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {gcalUrl && (
                <a className="map-link" href={gcalUrl} target="_blank" rel="noreferrer">
                  📅 Añadir a Google Calendar <HugeiconsIcon icon={ArrowUpRight01Icon} size={18} aria-hidden="true" />
                </a>
              )}
              <a className="map-link" href={`/api/events/${event.id}/calendar`} download>
                Descargar archivo .ics
              </a>
            </div>
          </section>

          <WeatherPanel
            latitude={event.latitude}
            longitude={event.longitude}
            date={event.date}
            time={event.startTime}
            outdoor={event.outdoor}
          />
        </article>

        <aside id="entradas" className="event-purchase" aria-label="Compra de entradas">
          <div className="price-card">
            <span>Entrada general</span>
            <strong>{formatCurrency(event.priceCents)}</strong>
            {usdEstimate && <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{usdEstimate} (tipo de cambio referencial)</span>}
          </div>
          <BuyerRegistration
            eventId={event.id}
            available={event.available}
            demoEnabled={process.env.DEMO_PAYMENTS_ENABLED === 'true'}
            mercadoPagoEnabled={process.env.MP_PAYMENTS_ENABLED === 'true'}
            reniecRequired={process.env.RENIEC_VERIFICATION_ENABLED === 'true'}
          />
        </aside>
      </section>

      <a className="mobile-purchase" href="#entradas" aria-label="Ver entradas" aria-describedby="mobile-ticket-price"><span>Entrada general<strong id="mobile-ticket-price">{formatCurrency(event.priceCents)}</strong></span><span>{event.available > 0 ? 'Ver entradas' : 'Agotado'}<HugeiconsIcon icon={ArrowUpRight01Icon} size={20} aria-hidden="true" /></span></a>
      <SiteFooter />
    </main>
  );
}
