import 'server-only';
import { AppError } from '@/lib/validation';

type Place = { id: number; label: string; latitude: number; longitude: number; type: string; city: string; address: string };
const cache = new Map<string, { until: number; places: Place[] }>();
const pending = new Map<string, Promise<Place[]>>();
// shortcut: queue is process-local for the localhost demo; coordinate globally before multiple instances.
let tail = Promise.resolve();
let lastStarted = 0;

export async function searchLocations(query: string) {
  const key = query.toLocaleLowerCase('es-PE');
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.places;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 8) throw new AppError('Hay varias búsquedas en curso. Reintenta en unos segundos.', 429);
  const contact = process.env.NOMINATIM_CONTACT;
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>(resolve => { release = resolve; });
  const work = (async () => {
    await previous;
    try {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastStarted))));
      lastStarted = Date.now();
      const url = new URL(process.env.NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'pe', addressdetails: '1', 'accept-language': 'es' }).toString();
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': `SamiTicket-Demo/1.0${contact ? ` (${contact})` : ''}` },
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Location service unavailable');
      const rows = await response.json() as { place_id: number; display_name: string; lat: string; lon: string; type: string; address?: Record<string, string> }[];
      const places = rows.map(row => ({ id: row.place_id, label: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon), type: row.type,
        address: row.display_name.slice(0, 300), city: (row.address?.city || row.address?.town || row.address?.village || row.address?.municipality || row.address?.county || row.address?.state || '').slice(0, 100),
      })).filter(row => row.label && Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90 && Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180);
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 3600000, places });
      return places;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('No pudimos buscar ubicaciones. Puedes ingresarla manualmente.', 503);
    } finally { release(); }
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
