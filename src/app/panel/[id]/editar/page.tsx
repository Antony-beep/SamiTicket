import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Problem } from '@/components/problem';
import { EventForm } from '@/components/event-form';
import { authorizedEvent } from '@/lib/server/data';
import { pageActor, pageData } from '@/lib/server/page-auth';

export default async function EditEventPage({ params }: PageProps<'/panel/[id]/editar'>) {
  const { id } = await params;
  const user = await pageActor(`/panel/${id}/editar`);
  const result = await pageData(() => authorizedEvent(id, user, true));
  if (result.error !== undefined) return <main><SiteHeader /><section className="container panel-page"><Problem message={result.error} /></section></main>;
  const event = result.data;
    return <main><SiteHeader /><section className="container panel-page"><Link href={`/panel/${id}`}>Volver al evento</Link><h1>Editar borrador</h1>
      {event.status === 'draft' ? <EventForm key={id} initial={event} /> : <Problem message="El evento ya fue publicado y sus datos están bloqueados." />}
    </section></main>;
}
