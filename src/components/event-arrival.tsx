'use client';
import { useEffect } from 'react';

export function EventArrival({eventId}: {eventId:string}) {
  useEffect(() => { window.dispatchEvent(new CustomEvent('samiticket:arrival',{detail:eventId})); }, [eventId]);
  return null;
}
