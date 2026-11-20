import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Problem } from '@/components/problem';
import { panelEvents } from '@/lib/server/data';
import { pageActor, pageData } from '@/lib/server/page-auth';
import { EventCard } from '@/components/event-card';

export default async function PanelPage({ searchParams }: PageProps<'/panel'>) {
  const deleted = (await searchParams).deleted === '1';
  const user = await pageActor('/panel');
  const result = await pageData(() => panelEvents(user));
  if (result.error !== undefined) return <main><SiteHeader /><section className="container panel-page"><Problem message={result.error} /></section></main>;
  const events = result.data;
    return <main><SiteHeader /><section className="container panel-page">
      <div className="section-heading"><div><p className="eyebrow">Organización y puerta</p><h1>Mi panel</h1></div><Link className="button button-primary" href="/crear-evento">Crear evento</Link></div>
      {deleted && <p className="notice notice-success" role="status">Evento eliminado.</p>}
      {!events.length && <p className="notice">No tienes eventos. Crea uno o pide al organizador que te asigne por correo.</p>}
      <div className="event-grid">{events.map(event => <EventCard key={event.id} event={{...event,coverSmallUrl:event.isOwner || event.status==='published' ? event.coverSmallUrl : null}} href={`/panel/${event.id}`} action={event.isOwner?'Gestionar evento':'Controlar ingreso'} badge={`${event.isOwner?'Organizador':'Personal de puerta'} · ${event.status==='draft'?'Borrador':'Publicado'}`} />)}</div>
    </section></main>;
}
