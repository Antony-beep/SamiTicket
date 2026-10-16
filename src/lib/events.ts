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
