import Link from 'next/link';
import { connection } from 'next/server';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { EventCatalog } from '@/components/event-catalog';
import { buttonVariants } from '@/components/ui/button';
import { Problem } from '@/components/problem';
import type { Event } from '@/lib/events';
import { publicEvents } from '@/lib/server/data';
import { AppError } from '@/lib/validation';
import { LiveSubtitles } from '@/components/live-subtitles';
import { HeroShaderGradient } from '@/components/hero-shader-gradient';

export default async function Home() {
  await connection();
  let events: Event[] = [];
  let problem = '';
  try { events = await publicEvents(); }
  catch (error) { problem = error instanceof AppError ? error.message : 'No pudimos conectar con Supabase.'; }
  return <main>
    <SiteHeader />
    <section className="container discovery-hero">
      <HeroShaderGradient />
      <h1>Hay noches que<br />se quedan <span>contigo.</span></h1>
      <div className="discovery-intro"><p>Fiestas, música y tradición. De Huancayo a todo el Perú. Encuentra tu próximo encuentro y lleva tu entrada en el celular.</p><a href="#eventos" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Explorar cartelera <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" /></a></div>
    </section>
    <LiveSubtitles />
    <section id="eventos" className="container events-section">
      <div className="section-heading"><h2>La cartelera<span className="accent-period">.</span></h2><span>Nos vemos ahí</span></div>
      {problem ? <Problem message={problem} /> : <EventCatalog events={events} />}
    </section>
    <section className="container organizer-invite"><div><h2>Tú pones la fiesta.<br /><span>Nosotros, la entrada.</span></h2><p>Publica tu evento, comparte un enlace y controla el ingreso con QR.</p></div><Link href="/crear-evento" className={buttonVariants({ size: 'lg' })}>Crear mi evento <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" /></Link></section>
    <SiteFooter />
  </main>;
}
