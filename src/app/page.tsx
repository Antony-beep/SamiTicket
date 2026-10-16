import Link from "next/link";
import Image from 'next/image';
import { SiteHeader } from "@/components/site-header";
import { formatCurrency, formatEventDate, type Event } from "@/lib/events";
import { publicEvents } from "@/lib/server/data";
import { AppError } from "@/lib/validation";
import { Problem } from "@/components/problem";
import { connection } from 'next/server';

const FEATURED_FESTIVE_EVENTS = [
  {
    slug: 'gran-concurso-huaylarsh-wanka-2026',
    title: 'Gran Concurso Nacional de Huaylarsh Wanka 2026',
    date: '2026-10-24',
    startTime: '13:00',
    venue: 'Coliseo Wanka, Huancayo',
    category: 'Huaylarsh & Danzas',
    priceCents: 3000,
    gradient: 'linear-gradient(135deg, #1b0a1a, #4a1532 50%, #991b1b)',
  },
  {
    slug: 'fiesta-patronal-tayta-shanti-2026',
    title: 'Festividad del Tayta Shanti: Santiago de Huancayo',
    date: '2026-10-30',
    startTime: '11:00',
    venue: 'Explanada Tradición Huanca, Cajas Chico',
    category: 'Santiago & Patronal',
    priceCents: 2500,
    gradient: 'linear-gradient(135deg, #091a10, #164e33 50%, #92400e)',
  },
  {
    slug: 'festival-saxofon-cumbia-huancaina',
    title: 'Noche de Gala: Saxofones y Cumbia Huancaína',
    date: '2026-11-06',
    startTime: '19:30',
    venue: 'Complejo Ferial de Huancayo',
    category: 'Orquestas & Saxofón',
    priceCents: 3500,
    gradient: 'linear-gradient(135deg, #071720, #0f374e 50%, #0369a1)',
  },
];

export default async function Home() {
  await connection();
  let events: Event[] = [];
  let problem = '';
  try {
    events = await publicEvents();
  } catch (error) {
    problem = error instanceof AppError ? error.message : 'No pudimos conectar con Supabase.';
  }

  const hasDbEvents = events.length > 0;

  return (
    <main>
      <SiteHeader />

      {/* Hero Festivo Inmersivo */}
      <section className="hero container">
        <div>
          <div className="hero-tag">
            <span className="hero-tag-dot" aria-hidden="true" />
            <span>Donde el Perú Celebra · Valle del Mantaro</span>
          </div>
          <h1>La fiesta y el folklore de Huancayo en tus manos.</h1>
          <p className="hero-copy">
            Tus entradas oficiales para fiestas patronales, concursos de Huaylarsh, orquestas del centro y festivales del Perú. Venta simple con QR seguro y validación al instante.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/crear-evento">
              Crear mi evento
            </Link>
            <a className="button button-secondary" href="#eventos">
              Ver cartelera festiva ↓
            </a>
          </div>
        </div>

        <aside className="hero-card">
          <p>Pase Oficial SamiTicket</p>
          <ol>
            <li><b>1</b> Elige tu fiesta o concierto</li>
            <li><b>2</b> Paga seguro con Yape, Plin o tarjeta</li>
            <li><b>3</b> Muestra tu boleto QR en puerta</li>
          </ol>
          <div className="hero-card-foot">
            <span>Control anti-reventa</span>
            <strong>100% Verificado</strong>
          </div>
        </aside>
      </section>

      {/* Cartelera de Eventos */}
      <section id="eventos" className="events-section container">
        <div className="festive-filter-bar" role="tablist" aria-label="Filtros de celebración">
          <span className="festive-pill active">Todas las fiestas</span>
          <span className="festive-pill">Huaylarsh & Danzas</span>
          <span className="festive-pill">Santiago & Patronales</span>
          <span className="festive-pill">Orquestas & Saxofón</span>
          <span className="festive-pill">Cumbia Huanca</span>
          <span className="festive-pill">Festivales & Ferias</span>
        </div>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Cartelera en Vivo</p>
            <h2>Próximas fiestas y eventos</h2>
          </div>
          <span>Huancayo · Junín · Todo el Perú</span>
        </div>

        {problem && <Problem message={problem} />}

        {/* Grilla con eventos de la Base de Datos */}
        {hasDbEvents && (
          <div className="event-grid">
            {events.map((event) => (
              <article className="event-card" key={event.slug}>
                <div className="event-cover">
                  {event.coverSmallUrl && (
                    <Image
                      src={event.coverSmallUrl}
                      alt={`Portada de ${event.title}`}
                      fill
                      unoptimized
                      sizes="(max-width: 760px) 100vw, 33vw"
                    />
                  )}
                  <span>{event.category}</span>
                </div>
                <div className="event-card-content">
                  <p>{formatEventDate(event.date)} · {event.startTime}</p>
                  <h3>{event.title}</h3>
                  <p>{event.venue}</p>
                  <div className="event-card-footer">
                    <strong>{formatCurrency(event.priceCents)}</strong>
                    <Link href={`/e/${event.slug}`}>Ver fiesta →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Si aún no hay eventos publicados en BD, mostrar la cartelera curada huancaína */}
        {!problem && !hasDbEvents && (
          <div>
            <div className="event-grid">
              {FEATURED_FESTIVE_EVENTS.map((fest) => (
                <article className="event-card" key={fest.slug}>
                  <div className="event-cover" style={{ background: fest.gradient }}>
                    <span>{fest.category}</span>
                  </div>
                  <div className="event-card-content">
                    <p>{fest.date} · {fest.startTime}</p>
                    <h3>{fest.title}</h3>
                    <p>{fest.venue}</p>
                    <div className="event-card-footer">
                      <strong>{formatCurrency(fest.priceCents)}</strong>
                      <Link href="/crear-evento">Publicar evento similar →</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="notice" style={{ marginTop: '28px' }}>
              <p>
                <strong>¿Organizas una fiesta patronal, concierto o concurso?</strong> Crea tu evento en SamiTicket en 2 minutos y empieza a vender entradas por internet.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Pilares de SamiTicket en el Valle del Mantaro */}
      <section className="container">
        <div className="festive-pillars">
          <article className="pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <h3>Cobro Local al Instante</h3>
            <p>Pensado para mayordomos y promotores. Venta con Yape, Plin y tarjetas bancarias sin intermediarios lentos.</p>
          </article>

          <article className="pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
              </svg>
            </div>
            <h3>Boleto QR Anti-Reventa</h3>
            <p>Pase único con token encriptado. Escaneo de alta velocidad en puertas de coliseos o locales, incluso sin internet.</p>
          </article>

          <article className="pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </div>
            <h3>Identidad y Tradición Viva</h3>
            <p>Diseñado con el corazón y el vigor del Valle del Mantaro para acompañar cada fiesta y danza de nuestro Perú.</p>
          </article>
        </div>
      </section>

      {/* Pie de Página Folclórico */}
      <footer className="festive-footer">
        <div className="chumpi-band" aria-hidden="true" style={{ marginBottom: '28px' }} />
        <div className="container footer-content">
          <div className="footer-brand">
            <span className="brand">Sami<span>Ticket</span></span>
            <span>El latido festivo de Huancayo y todo el Perú</span>
          </div>
          <div className="footer-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>Hecho para patronales, orquestas, concursos y festivales</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
