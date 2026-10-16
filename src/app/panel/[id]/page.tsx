import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Problem } from '@/components/problem';
import { EventActions } from '@/components/event-actions';
import { Scanner } from '@/components/scanner';
import { CoverManager } from '@/components/cover-manager';
import { DeleteEvent } from '@/components/delete-event';
import { authorizedEvent, ownerSummary } from '@/lib/server/data';
import { pageActor, pageData } from '@/lib/server/page-auth';
import { formatCurrency, formatEventDate } from '@/lib/events';

export default async function ManageEventPage({ params }: PageProps<'/panel/[id]'>) {
  const { id } = await params;
  const user = await pageActor(`/panel/${id}`);
  const result = await pageData(async () => {
    const event = await authorizedEvent(id, user);
    const summary = event.isOwner ? await ownerSummary(id, user) : null;
    return { event, summary };
  });
  if (result.error !== undefined) return <main><SiteHeader /><section className="container panel-page"><Problem message={result.error} /><Link href="/panel">Volver al panel</Link></section></main>;
  const { event, summary } = result.data;
    const sold = event.capacity - event.available;
    return <main><SiteHeader /><section className="container panel-page">
      <Link className="text-link" href="/panel">Volver a mi panel</Link>
      <p className="eyebrow">{event.status === 'draft' ? 'Borrador' : 'Publicado'} · {event.isOwner ? 'Organizador' : 'Personal de puerta'}</p>
      <h1>{event.title || 'Evento sin nombre'}</h1><p>{formatEventDate(event.date)} {event.startTime} · {event.venue}</p>
      {summary && <>
        <div className="stats"><article><span>Entradas emitidas</span><strong>{sold} / {event.capacity}</strong></article><article><span>Ingresos simulados</span><strong>{formatCurrency(sold * event.priceCents)}</strong></article><article><span>Ingresos en puerta</span><strong>{summary.entries}</strong></article></div>
        <div className="actions">{event.status === 'draft' ? <Link className="button button-secondary" href={`/panel/${id}/editar`}>Editar borrador</Link> : <Link className="button button-secondary" href={`/e/${event.slug}`}>Abrir página pública</Link>}</div>
        <EventActions eventId={id} status={event.status} staff={summary.staff} />
        <CoverManager key={event.coverSmallUrl} eventId={id} currentUrl={event.coverSmallUrl} published={event.status === 'published'} />
      </>}
      <section className="panel-card"><h2>Control de ingreso</h2><p>Requiere internet. Cada entrada permite un solo ingreso.</p><Scanner key={id} eventId={id} /></section>
      {summary && <section className="panel-card"><h2>Últimas 100 órdenes</h2><p>Todos los importes corresponden a pagos simulados.</p><div className="table-scroll"><table><thead><tr><th>Comprador</th><th>Correo</th><th>Importe</th><th>Estado</th></tr></thead><tbody>{summary.orders.map(order => <tr key={order.id}><td>{order.buyer_name}</td><td>{order.buyer_email}</td><td>{formatCurrency(order.amount_cents)}</td><td>{({ pending: 'Pendiente', paid: 'Aprobado', rejected: 'Rechazado' } as Record<string, string>)[order.status]}</td></tr>)}</tbody></table></div>{!summary.orders.length && <p>Aún no hay órdenes.</p>}</section>}
      {summary && <DeleteEvent id={id} title={event.title} hasOrders={summary.orders.length > 0} />}
    </section></main>;
}
