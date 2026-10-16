import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { AppError, uuid } from '@/lib/validation';
import type { Event } from '@/lib/events';

export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('Falta configurar Supabase y SUPABASE_SERVICE_ROLE_KEY en el servidor.', 503);
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const errors: Record<string, [string, number]> = {
  forbidden: ['No tienes permiso para este evento.', 403], published_immutable: ['Un evento publicado ya no se puede editar.', 409],
  incomplete_event: ['Completa los datos, la ubicación y una fecha futura antes de publicar.', 400],
  unregistered_staff: ['El correo debe pertenecer a una cuenta verificada. Pídele que inicie sesión primero.', 400],
  owner_is_staff: ['El propietario ya puede controlar el ingreso.', 400],
  idempotency_conflict: ['Esta solicitud ya se usó con otros datos. Inicia una nueva compra.', 409],
  event_unavailable: ['Este evento ya no está disponible para comprar.', 409], sold_out: ['Entradas agotadas. No se emitió ninguna entrada.', 409],
  receipt_denied: ['Este comprobante no está disponible en este navegador.', 403],
  cover_conflict: ['La portada cambió en otra pestaña. Recarga antes de reintentar.', 409],
  event_has_orders: ['No se puede eliminar: existen órdenes pendientes, aprobadas o rechazadas.', 409],
};
export function databaseError(error: { message: string; code?: string }) {
  const code = /ST:([a-z_]+)/.exec(error.message)?.[1];
  if (code && errors[code]) throw new AppError(...errors[code]);
  if (['42P01', '42703', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) throw new AppError('Falta aplicar las migraciones de SamiTicket en Supabase, incluida 202610160002_event_improvements.sql.', 503);
  throw new AppError('No pudimos completar la operación en Supabase. Revisa la conexión y configuración.', 503);
}
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await database().rpc(name, args);
  if (error) databaseError(error);
  return data as T;
}
export async function actor() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AppError('Inicia sesión para continuar.', 401);
  return data.user.id;
}
export type EventRow = {
  id: string; owner_id: string; slug: string; title: string; description: string; starts_at: string | null;
  venue: string; address: string; city: string; latitude: number | null; longitude: number | null;
  category: string; outdoor: boolean; status: 'draft' | 'published';
  reference: string; cover_version: string | null;
  ticket_types: { price_cents: number; capacity: number; sold: number } | null;
};
const eventFields = 'id,owner_id,slug,title,description,starts_at,venue,address,city,latitude,longitude,category,outdoor,status,reference,cover_version,ticket_types(price_cents,capacity,sold)';
export function eventDTO(row: EventRow): Event {
  const local = row.starts_at ? new Date(new Date(row.starts_at).getTime() - 5 * 3600000).toISOString() : '';
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description, date: local.slice(0, 10), startTime: local.slice(11, 16),
    venue: row.venue, address: row.address, city: row.city, latitude: row.latitude, longitude: row.longitude,
    category: row.category, outdoor: row.outdoor, status: row.status, priceCents: row.ticket_types?.price_cents ?? 0,
    capacity: row.ticket_types?.capacity ?? 0, available: (row.ticket_types?.capacity ?? 0) - (row.ticket_types?.sold ?? 0),
    reference: row.reference, coverSmallUrl: row.cover_version ? `/api/events/${row.id}/cover?size=small&v=${row.cover_version}` : null,
    coverLargeUrl: row.cover_version ? `/api/events/${row.id}/cover?size=large&v=${row.cover_version}` : null,
  };
}
export async function publicEvents(slug?: string) {
  let query = database().from('events').select(eventFields).eq('status', 'published').gt('starts_at', new Date().toISOString()).order('starts_at');
  if (slug) query = query.eq('slug', slug);
  const { data, error } = await query;
  if (error) databaseError(error);
  return (data as unknown as EventRow[]).map(eventDTO);
}
export async function panelEvents(user: string) {
  const db = database();
  const { data: staff, error: staffError } = await db.from('event_staff').select('event_id').eq('user_id', user);
  if (staffError) databaseError(staffError);
  const ids = (staff ?? []).map(row => row.event_id);
  const filter = ids.length ? `owner_id.eq.${user},id.in.(${ids.join(',')})` : `owner_id.eq.${user}`;
  const { data, error } = await db.from('events').select(eventFields).or(filter).order('created_at', { ascending: false });
  if (error) databaseError(error);
  return (data as unknown as EventRow[]).map(row => ({ ...eventDTO(row), isOwner: row.owner_id === user }));
}
export async function authorizedEvent(id: string, user: string, ownerOnly = false) {
  uuid(id);
  const db = database();
  const { data, error } = await db.from('events').select(eventFields).eq('id', id).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new AppError('Evento no encontrado.', 404);
  const row = data as unknown as EventRow;
  const isOwner = row.owner_id === user;
  if (!isOwner) {
    if (ownerOnly) throw new AppError('No tienes permiso para este evento.', 403);
    const { data: member, error: memberError } = await db.from('event_staff').select('user_id').eq('event_id', id).eq('user_id', user).maybeSingle();
    if (memberError) databaseError(memberError);
    if (!member) throw new AppError('No tienes permiso para este evento.', 403);
  }
  return { ...eventDTO(row), isOwner };
}
export async function ownerSummary(eventId: string, user: string) {
  await authorizedEvent(eventId, user, true);
  const db = database();
  const [staff, orders, entries] = await Promise.all([
    db.from('event_staff').select('email').eq('event_id', eventId).order('email'),
    db.from('orders').select('id,buyer_name,buyer_email,amount_cents,status,created_at').eq('event_id', eventId).order('created_at', { ascending: false }).limit(100),
    db.from('check_ins').select('ticket_id', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);
  for (const result of [staff, orders, entries]) if (result.error) databaseError(result.error);
  return { staff: staff.data ?? [], orders: orders.data ?? [], entries: entries.count ?? 0 };
}
export function requireDemo() {
  if (process.env.DEMO_PAYMENTS_ENABLED !== 'true') throw new AppError('Los pagos simulados están deshabilitados.', 403);
}
export const checkoutCookie = 'samiticket_checkout';
export function receiptHash(secret: string, orderId: string) {
  const access = createHmac('sha256', secret).update(`receipt:${orderId}`).digest();
  return createHash('sha256').update(access).digest('hex');
}
export async function orderAccess(orderId: string) {
  uuid(orderId);
  const secret = (await cookies()).get(checkoutCookie)?.value;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new AppError('Abre la compra en el navegador donde la iniciaste.', 403);
  return receiptHash(secret, orderId);
}
export async function receipt(orderId: string) {
  const hash = await orderAccess(orderId);
  const db = database();
  const { data, error } = await db.from('orders').select('id,event_id,buyer_name,buyer_email,amount_cents,status,access_hash').eq('id', orderId).maybeSingle();
  if (error) databaseError(error);
  if (!data || !timingSafeEqual(Buffer.from(data.access_hash, 'hex'), Buffer.from(hash, 'hex'))) throw new AppError('Este comprobante no está disponible en este navegador.', 403);
  const [event, ticket] = await Promise.all([
    db.from('events').select('title,venue,address,starts_at,slug').eq('id', data.event_id).single(),
    db.from('tickets').select('token').eq('order_id', orderId).maybeSingle(),
  ]);
  if (event.error) databaseError(event.error);
  if (ticket.error) databaseError(ticket.error);
  if (!event.data) throw new AppError('No encontramos el evento del comprobante.', 404);
  return { id: data.id, eventId: data.event_id, name: data.buyer_name, email: data.buyer_email,
    amountCents: data.amount_cents, status: data.status as 'pending' | 'paid' | 'rejected', event: event.data, token: ticket.data?.token ?? null };
}
