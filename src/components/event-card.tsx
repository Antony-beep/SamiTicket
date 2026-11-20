'use client';
import Link from 'next/link';
import { ArrowUpRight, Ticket } from 'lucide-react';
import { CutoutCard, CutoutCardMedia, CutoutCardImage, CutoutCardInsetLabel, CutoutCorner, CutoutCardContent, CutoutCardFooter } from '@/components/ui/cutout-card';
import { formatCurrency, formatEventDate, type Event } from '@/lib/events';

export function EventCard({event,href,action,badge}: {event:Event;href:string;action:string;badge:string}) {
  return <CutoutCard className="event-cutout catalog-card group/cutout" initial={false}>
    <CutoutCardMedia className="cutout-media">
      {event.coverSmallUrl ? <CutoutCardImage src={event.coverSmallUrl} alt={`Portada de ${event.title}`} unoptimized sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" /> : <div className="poster-placeholder"><Ticket size={56} strokeWidth={1} /><span>SamiTicket</span></div>}
      <CutoutCardInsetLabel className="cutout-event-label"><span>{badge}</span><CutoutCorner className="cutout-label-right" /><CutoutCorner className="cutout-label-top" /></CutoutCardInsetLabel>
    </CutoutCardMedia>
    <CutoutCardContent className="cutout-event-content"><p className="event-date">{formatEventDate(event.date)} · {event.startTime}</p><h3><Link href={href}>{event.title || 'Evento sin nombre'}</Link></h3><p className="event-location">{event.venue || 'Local pendiente'} · {event.city}</p><CutoutCardFooter className="cutout-event-footer"><strong>{formatCurrency(event.priceCents)}</strong><span>{event.available > 0 ? action : 'Agotado'}</span><ArrowUpRight size={20} aria-hidden="true" /></CutoutCardFooter></CutoutCardContent>
  </CutoutCard>;
}
