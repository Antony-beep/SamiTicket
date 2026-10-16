import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Explicit disposable-environment opt-in; never reads application secrets automatically.
const enabled = process.env.TEST_DATABASE_CONFIRM === 'samiticket-test-only' && Boolean(process.env.TEST_APP_URL && process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY && process.env.TEST_SUPABASE_PUBLISHABLE_KEY);
describe.skipIf(!enabled)('live Next.js routes and remote Supabase', () => {
  let db: SupabaseClient;
  const users: string[] = [], events = [randomUUID(), randomUUID()];
  const organizer = new Map<string, string>(), stranger = new Map<string, string>(), staff = new Map<string, string>(), buyer = new Map<string, string>();
  const origin = process.env.TEST_APP_URL!;
  const input = { title: 'Fiesta QA temporal', description: 'Fixture de prueba: eliminar al terminar.', date: '2099-10-20', startTime: '20:00', venue: 'Local QA', address: 'Dirección de prueba', city: 'Cusco', reference: 'Portón de prueba', latitude: -13.5319, longitude: -71.9675, category: 'Prueba', outdoor: true, price: '0,29', capacity: 2 };
  async function request(path: string, method = 'GET', data?: unknown, jar = organizer) {
    const headers = new Headers({ Origin: origin, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') });
    if (data !== undefined && !(data instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${origin}${path}`, { method, headers, body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data), redirect: 'manual' });
    for (const item of response.headers.getSetCookie()) { const pair = item.split(';')[0]; const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
    return response;
  }
  async function image() {
    const file = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: '#1b5b42' } }).png().toBuffer();
    const form = new FormData(); form.set('cover', new File([new Uint8Array(file)], 'afiche.png', { type: 'image/png' })); return form;
  }
  beforeAll(async () => {
    db = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    for (const [role, jar] of [['organizer', organizer], ['stranger', stranger], ['staff', staff]] as const) {
      const email = `samiticket-live-${role}-${events[0]}@example.invalid`, password = randomBytes(32).toString('hex');
      const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error('No se pudo crear usuario temporal.');
      users.push(created.data.user.id);
      const auth = createServerClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: items => { for (const item of items) jar.set(item.name, item.value); } } });
      const signed = await auth.auth.signInWithPassword({ email, password });
      if (signed.error) throw new Error('No se pudo iniciar sesión de prueba.');
    }
  });
  afterAll(async () => {
    if (!db) return;
    const failed: string[] = [];
    for (const id of events) {
      const folders = await db.storage.from('event-covers').list(id);
      for (const folder of folders.data ?? []) {
        const removed = await db.storage.from('event-covers').remove(['small', 'large'].map(size => `${id}/${folder.name}/${size}.webp`));
        if (removed.error) failed.push(`cover ${id}`);
      }
      for (const table of ['check_ins', 'tickets', 'orders', 'event_staff', 'ticket_types', 'cover_cleanup']) {
        const removed = await db.from(table).delete().eq('event_id', id); if (removed.error) failed.push(`${table} ${id}`);
      }
      const removed = await db.from('events').delete().eq('id', id); if (removed.error) failed.push(`event ${id}`);
    }
    for (const id of users) { const removed = await db.auth.admin.deleteUser(id); if (removed.error) failed.push(`user ${id}`); }
    if (failed.length) throw new Error(`Limpieza pendiente: ${failed.join(', ')}`);
  });
  it('saves, validates, protects, publishes and replaces a cover through actual HTTP handlers', async () => {
    const id = events[0];
    expect((await request('/api/events', 'POST', { ...input, id, price: '12.345' })).status).toBe(400);
    expect((await request('/api/events', 'POST', { ...input, id })).status).toBe(201);
    expect((await request(`/api/events/${id}`, 'GET', undefined, stranger)).status).toBe(403);
    const missing = await request(`/api/events/${id}/publish`, 'POST'); expect(missing.status).toBe(400); expect((await missing.json()).errors.cover).toBeTruthy();
    expect((await request(`/api/events/${id}/cover`, 'PUT', await image())).status).toBe(200);
    const small = await request(`/api/events/${id}/cover?size=small`); expect(small.status).toBe(200); expect((await small.arrayBuffer()).byteLength).toBeLessThanOrEqual(180000);
    expect((await request(`/api/events/${id}/cover?size=small`, 'GET', undefined, stranger)).status).toBe(403);
    expect((await request(`/api/events/${id}/cover?size=small`, 'GET', undefined, buyer)).status).toBe(401);
    const bad = new FormData(); bad.set('cover', new File(['broken'], 'bad.png', { type: 'image/png' }));
    expect((await request(`/api/events/${id}/cover`, 'PUT', bad)).status).toBe(422);
    expect((await request(`/api/events/${id}/cover?size=small`)).status).toBe(200);
    expect((await request(`/api/events/${id}/publish`, 'POST')).status).toBe(200);
    expect((await request(`/api/events/${id}/cover?size=large`, 'GET', undefined, buyer)).status).toBe(200);
    expect((await request(`/api/events/${id}/cover`, 'DELETE')).status).toBe(409);
    expect((await request(`/api/events/${id}`, 'PATCH', { ...input, title: 'Cambio' })).status).toBe(409);
    expect((await request(`/api/events/${id}/cover`, 'PUT', await image())).status).toBe(200);
    const catalog = await request('/', 'GET', undefined, buyer); const html = await catalog.text();
    expect(html).toContain(`/api/events/${id}/cover?size=small`); expect(html).not.toContain(`/api/events/${id}/cover?size=large`);
    const detail = await request(`/e/evento-${id}`, 'GET', undefined, buyer); const page = await detail.text();
    expect(page).toContain(`/api/events/${id}/cover?size=large`); expect(page).not.toContain(`/api/events/${id}/cover?size=small`); expect(page).toContain('destination=-13.5319,-71.9675');
    expect((await request(`/api/events/${id}/staff`, 'POST', { email: `samiticket-live-staff-${id}@example.invalid` })).status).toBe(200);
    expect((await request(`/api/events/${id}`, 'DELETE', undefined, staff)).status).toBe(403);
  }, 60000);
  it('buys, downloads a private PNG, checks in once and blocks deletion with an order', async () => {
    const eventId = events[0], id = randomUUID();
    expect((await request('/api/orders/session', 'POST', undefined, buyer)).status).toBe(200);
    const order = { id, eventId, name: 'Comprador de prueba', email: `samiticket.qa+${id}@gmail.com` };
    const created = await request('/api/orders', 'POST', order, buyer);
    if (created.status !== 201) throw new Error(`Compra HTTP falló: ${created.status} ${(await created.json()).message}`);
    expect((await request('/api/orders', 'POST', order, buyer)).status).toBe(201);
    expect((await request(`/api/orders/${id}/simulate`, 'POST', { approve: true }, buyer)).status).toBe(200);
    expect((await request(`/api/orders/${id}/simulate`, 'POST', { approve: true }, buyer)).status).toBe(200);
    const receipt = await request(`/api/orders/${id}`, 'GET', undefined, buyer); const data = await receipt.json();
    expect(data.token).toMatch(/^[a-f0-9]{64}$/);
    expect((await request(`/api/orders/${id}`, 'GET', undefined, stranger)).status).toBe(403);
    const qr = await request(`/api/orders/${id}/qr`, 'GET', undefined, buyer); expect(qr.status).toBe(200); expect(qr.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await qr.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const status of ['accepted', 'used']) { const scanned = await request(`/api/events/${eventId}/check-in`, 'POST', { token: data.token }, staff); expect((await scanned.json()).status).toBe(status); }
    expect((await request(`/api/events/${eventId}`, 'DELETE')).status).toBe(409);
    expect((await request(`/api/events/${eventId}/staff`, 'DELETE', { email: `samiticket-live-staff-${eventId}@example.invalid` })).status).toBe(200);
    expect((await request(`/api/events/${eventId}/check-in`, 'POST', { token: data.token }, staff)).status).toBe(403);
  }, 60000);
  it('removes both variants when an empty draft is deleted', async () => {
    const id = events[1];
    expect((await request('/api/events', 'POST', { ...input, id })).status).toBe(201);
    const cover = await request(`/api/events/${id}/cover`, 'PUT', await image()); const version = (await cover.json()).version;
    expect((await request(`/api/events/${id}`, 'DELETE')).status).toBe(200);
    expect((await request(`/api/events/${id}`)).status).toBe(404);
    const files = await db.storage.from('event-covers').list(`${id}/${version}`); expect(files.error).toBeNull(); expect(files.data).toHaveLength(0);
  }, 60000);
});
