export type Event = {
  id: string; slug: string; title: string; description: string; date: string; startTime: string;
  venue: string; address: string; city: string; latitude: number | null; longitude: number | null;
  priceCents: number; capacity: number; available: number; category: string; outdoor: boolean;
  status: 'draft' | 'published';
  reference: string; coverSmallUrl: string | null; coverLargeUrl: string | null;
};

export function formatEventDate(date: string) {
  if (!date) return 'Fecha pendiente';
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima',
  }).format(new Date(`${date}T12:00:00-05:00`));
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(cents / 100);
}

export function googleCalendarUrl(input: {
  title: string;
  startsAt: string | null | undefined;
  venue?: string;
  address?: string;
  city?: string;
  details?: string;
}) {
  if (!input.startsAt) return null;
  const start = new Date(input.startsAt);
  if (!Number.isFinite(start.getTime())) return null;
  const end = new Date(start.getTime() + 3 * 3600_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const location = [input.venue, input.address, input.city].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ctz: 'America/Lima',
  });
  if (location) params.set('location', location);
  if (input.details) params.set('details', input.details.slice(0, 800));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
