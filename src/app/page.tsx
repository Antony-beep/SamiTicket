import Link from "next/link";
import Image from 'next/image';
import { AuthControl } from "@/components/auth/auth-control";
import { formatCurrency, formatEventDate, type Event } from "@/lib/events";
import { publicEvents } from "@/lib/server/data";
import { AppError } from "@/lib/validation";
import { Problem } from "@/components/problem";
import { connection } from 'next/server';

export default async function Home() {
  await connection();
  let events: Event[] = [];
  let problem = '';
  try { events = await publicEvents(); }
  catch (error) { problem = error instanceof AppError ? error.message : 'No pudimos conectar con Supabase.'; }
  return (
    <main>
      <header className="site-header container">
        <Link className="brand" href="/">Sami<span>Ticket</span></Link>
        <nav>
          <Link href="/crear-evento">Crear evento</Link>
          <AuthControl />
        </nav>
      </header>

      <section className="hero container">
        <div>
          <p className="eyebrow">Eventos locales, sin complicaciones</p>
          <h1>Vende entradas y controla el ingreso desde tu celular.</h1>
          <p className="hero-copy">SamiTicket reemplaza las capturas de pago y las listas manuales por una venta simple, entradas QR y control de acceso.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/crear-evento">Crear mi evento</Link>
            <a className="button button-secondary" href="#eventos">Ver eventos</a>
          </div>
        </div>
        <aside className="hero-card">
          <p>Flujo simple</p>
          <ol>
            <li><b>1</b> Crea tu evento</li>
            <li><b>2</b> Comparte tu enlace</li>
            <li><b>3</b> Valida QR en puerta</li>
          </ol>
        </aside>
      </section>

      <section id="eventos" className="events-section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agenda local</p>
            <h2>Próximos eventos</h2>
          </div>
          <span>Perú</span>
        </div>
        {problem && <Problem message={problem} />}
        {!problem && events.length === 0 && <p className="notice">Aún no hay eventos publicados. Crea y publica tu primer evento.</p>}
        <div className="event-grid">
          {events.map((event) => (
            <article className="event-card" key={event.slug}>
              <div className="event-cover">{event.coverSmallUrl && <Image src={event.coverSmallUrl} alt={`Portada de ${event.title}`} fill unoptimized sizes="(max-width: 760px) 100vw, 33vw" />}<span>{event.category}</span></div>
              <div className="event-card-content">
                <p>{formatEventDate(event.date)} · {event.startTime}</p>
                <h3>{event.title}</h3>
                <p>{event.venue}</p>
                <div className="event-card-footer">
                  <strong>{formatCurrency(event.priceCents)}</strong>
                  <Link href={`/e/${event.slug}`}>Ver evento →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
