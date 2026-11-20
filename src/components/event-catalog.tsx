'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, Search01Icon, Ticket01Icon } from '@hugeicons/core-free-icons';
import type { Event } from '@/lib/events';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { EventCard } from './event-card';
import { GradientButtonGroup } from '@/components/ui/gradient-button-group';
import { Grid2X2, TicketCheck, TicketX } from 'lucide-react';

export function EventCatalog({ events }: { events: Event[] }) {
  const [query, setQuery] = useState('');
  const [availability,setAvailability] = useState('all');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE').trim();
  const visible = events.filter(event => (availability==='all' || (availability==='available' ? event.available>0 : event.available===0)) && normalize(`${event.title} ${event.city} ${event.venue} ${event.category}`).includes(normalize(query)));
  if (!events.length) return <div className="catalog-empty"><HugeiconsIcon icon={Ticket01Icon} size={40} strokeWidth={1.25} aria-hidden="true" /><div><h3>La próxima fiesta puede ser la tuya.</h3><p>Aún no hay eventos publicados con fecha futura. Publica el tuyo y dale lugar en la cartelera.</p></div><Link className={buttonVariants({ variant: 'outline', size: 'lg' })} href="/crear-evento">Crear un evento <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" /></Link></div>;
  return <>
    <div className="catalog-toolbar"><div className="catalog-search"><Input leadingSlot={<HugeiconsIcon icon={Search01Icon} size={20} aria-hidden="true" />} type="search" aria-label="Buscar por evento, ciudad o local" placeholder="Busca tu próxima fiesta o ciudad" value={query} onChange={e => setQuery(e.target.value)} /></div><GradientButtonGroup items={[{id:'all',label:'Todos',icon:<Grid2X2 size={18} />},{id:'available',label:'Disponibles',icon:<TicketCheck size={18} />},{id:'soldout',label:'Agotados',icon:<TicketX size={18} />}]} value={availability} onValueChange={setAvailability} /><p aria-live="polite">{visible.length} {visible.length === 1 ? 'evento' : 'eventos'} por descubrir</p></div>
    {!visible.length ? <div className="catalog-empty" role="status"><div><h3>No encontramos eventos{query ? ` para «${query}»` : ' con este filtro'}.</h3><p>Prueba con otra ciudad, local o disponibilidad.</p></div><Button variant="outline" onClick={() => {setQuery('');setAvailability('all');}}>Limpiar búsqueda</Button></div> : <div className="event-grid catalog-grid">{visible.map(event => <EventCard key={event.id} event={event} href={`/e/${event.slug}`} action="Ver evento" badge={event.category} />)}</div>}
  </>;
}
