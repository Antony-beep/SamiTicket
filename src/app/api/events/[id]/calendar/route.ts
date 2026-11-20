import { database, databaseError } from '@/lib/server/data';
import { api } from '@/lib/server/http';
import { AppError, uuid } from '@/lib/validation';

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function icsEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
}

export function buildEventIcs(event: {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  venue: string;
  address: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const startMs = new Date(event.starts_at).getTime();
  const endIso = new Date(startMs + 3 * 3600_000).toISOString();
  const location = [event.venue, event.address, event.city].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SamiTicket//Eventos Peru//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@samiticket.pe`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(event.starts_at)}`,
    `DTEND:${icsDate(endIso)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `LOCATION:${icsEscape(location)}`,
  ];
  if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
    lines.push(`GEO:${event.latitude};${event.longitude}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export async function GET(_request: Request, context: RouteContext<'/api/events/[id]/calendar'>) {
  return api(async () => {
    const id = uuid((await context.params).id);
    const { data, error } = await database()
      .from('events')
      .select('id,slug,title,description,starts_at,venue,address,city,latitude,longitude,status')
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();
    if (error) databaseError(error);
    if (!data || !data.starts_at) throw new AppError('Evento no disponible para exportar a calendario.', 404);
    const ics = buildEventIcs(data);
    const filename = `${(data.slug || 'evento').replace(/[^a-z0-9-_]/gi, '-')}.ics`;
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
