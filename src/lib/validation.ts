export class AppError extends Error {
  constructor(message: string, public status = 400, public errors?: Record<string, string>) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Datos inválidos.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max: number, min = 0) {
  const normalized = typeof value === 'string' ? value.trim().replace(/[^\S\r\n]+/g, ' ') : '';
  if (typeof value !== 'string' || normalized.length < min || normalized.length > max) {
    throw new AppError(`${label}: usa entre ${min} y ${max} caracteres.`);
  }
  return normalized;
}
export function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError('Identificador inválido.');
  return value;
}
export function email(value: unknown) {
  const result = text(value, 'Correo', 254, 3).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new AppError('Ingresa un correo válido.');
  return result;
}
export function safeNext(value: unknown, fallback = '/panel') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://samiticket.invalid');
    if (url.origin !== 'https://samiticket.invalid' || url.pathname === '/login' || url.pathname.startsWith('/auth/')) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}
export function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new AppError(`${label} inválido.`);
  return value;
}
export function coordinate(value: unknown, max: number) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > max) throw new AppError('Coordenadas inválidas.');
  return value;
}
export function priceCents(value: unknown) {
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new AppError('Usa un precio válido con máximo dos decimales.');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return integer(Number(whole) * 100 + Number(fraction.padEnd(2, '0')), 'Precio (S/ 0 a S/ 1 000 000)', 0, 100000000);
}
export function qrToken(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value.trim())) throw new AppError('El token debe tener 64 caracteres hexadecimales.', 400, { token: 'El token debe tener 64 caracteres hexadecimales.' });
  return value.trim().toLowerCase();
}
export function buyerInput(value: unknown) {
  const data = object(value);
  const errors: Record<string, string> = {};
  let name = '', address = '';
  try { name = text(data.name, 'Nombre', 120, 2); } catch (e) { errors.name = (e as Error).message; }
  try { address = email(data.email); } catch (e) { errors.email = (e as Error).message; }
  if (Object.keys(errors).length) throw new AppError('Revisa los campos indicados.', 400, errors);
  return { name, email: address };
}
export function publicationErrors(data: { title: string; description: string; date: string; startTime: string; venue: string; address: string; city: string; latitude: number | null; longitude: number | null }, hasCover: boolean) {
  const errors: Record<string, string> = {};
  for (const key of ['title', 'description', 'venue', 'address', 'city'] as const) if (!data[key].trim()) errors[key] = 'Completa este campo para publicar.';
  const starts = new Date(`${data.date}T${data.startTime}:00-05:00`).getTime();
  if (!data.date || !data.startTime || !Number.isFinite(starts) || starts <= Date.now()) errors.date = 'Elige una fecha y hora futuras.';
  if (data.latitude === null || data.longitude === null) errors.latitude = 'Indica la ubicación exacta para publicar.';
  if (!hasCover) errors.cover = 'Añade una portada para publicar.';
  return errors;
}
export function eventInput(value: unknown) {
  const data = object(value);
  const errors: Record<string, string> = {};
  function field<T>(key: string, parse: () => T, fallback: T): T {
    try { return parse(); } catch (e) { errors[key] = (e as Error).message; return fallback; }
  }
  const date = field('date', () => text(data.date ?? '', 'Fecha', 10), '');
  const time = field('startTime', () => text(data.startTime ?? '', 'Hora', 5), '');
  let startsAt: string | null = null;
  if (date || time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { errors.date = errors.startTime = 'Completa fecha y hora válidas juntas.'; }
    else {
      const parsed = new Date(`${date}T${time}:00-05:00`);
      if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() - 5 * 3600000).toISOString().slice(0, 10) !== date) errors.date = 'Fecha inválida.';
      else startsAt = parsed.toISOString();
    }
  }
  const result = {
    title: field('title', () => text(data.title ?? '', 'Nombre', 160), ''), description: field('description', () => text(data.description ?? '', 'Descripción', 5000), ''),
    starts_at: startsAt, venue: field('venue', () => text(data.venue ?? '', 'Local', 200), ''), address: field('address', () => text(data.address ?? '', 'Dirección', 300), ''),
    city: field('city', () => text(data.city ?? '', 'Ciudad', 100), ''), reference: field('reference', () => text(data.reference ?? '', 'Referencia', 300), ''),
    latitude: field('latitude', () => coordinate(data.latitude, 90), null), longitude: field('longitude', () => coordinate(data.longitude, 180), null),
    category: field('category', () => text(data.category || 'Eventos locales', 'Categoría', 80), ''), outdoor: data.outdoor === true,
    price_cents: field('price', () => data.priceCents === undefined ? priceCents(data.price) : integer(data.priceCents, 'Precio', 0, 100000000), 0),
    capacity: field('capacity', () => integer(data.capacity, 'Cantidad', 1, 10000), 0),
  };
  if ((result.latitude === null) !== (result.longitude === null)) errors.latitude = errors.longitude = 'Completa ambas coordenadas o deja ambas vacías.';
  if (data.outdoor !== undefined && typeof data.outdoor !== 'boolean') errors.outdoor = 'Selecciona una opción válida.';
  if (Object.keys(errors).length) throw new AppError('Revisa los campos indicados.', 400, errors);
  return result;
}
