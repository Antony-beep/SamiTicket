import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';

// Never falls back to the app's project. Explicitly opt in on a disposable test project.
const enabled = process.env.TEST_DATABASE_CONFIRM === 'samiticket-test-only' && Boolean(
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY && process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
);
describe.skipIf(!enabled)('remote Supabase: independent concurrent transactions', () => {
  let a: SupabaseClient; let b: SupabaseClient; let anonymous: SupabaseClient;
  const users: string[] = [];
  const eventId = randomUUID();
  const fixtureEvents = new Set([eventId]);
  const hash = randomBytes(32).toString('hex');
  async function call(client: SupabaseClient, name: string, args: Record<string, unknown>) {
    const result = await client.rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  beforeAll(async () => {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    a = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, options);
    b = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, options);
    anonymous = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_PUBLISHABLE_KEY!, options);
    const schema = await a.from('events').select('reference,cover_version').limit(0);
    if (schema.error) throw new Error('Aplica ambas migraciones antes de las pruebas remotas.');
    for (const role of ['owner', 'staff', 'other']) {
      const result = await a.auth.admin.createUser({ email: `samiticket-${role}-${eventId}@example.invalid`, email_confirm: true });
      if (result.error || !result.data.user) throw new Error(result.error?.message || 'No test user');
      users.push(result.data.user.id);
    }
  });
  afterAll(async () => {
    if (!a) return;
    const failures: string[] = [];
    for (const fixture of fixtureEvents) {
    for (const table of ['check_ins', 'tickets', 'orders', 'event_staff', 'ticket_types', 'cover_cleanup']) {
      const result = await a.from(table).delete().eq('event_id', fixture);
      if (result.error) failures.push(table);
    }
    const event = await a.from('events').delete().eq('id', fixture);
    if (event.error) failures.push('events');
    const versions = await a.storage.from('event-covers').list(fixture);
    for (const folder of versions.data ?? []) {
      const removed = await a.storage.from('event-covers').remove(['small', 'large'].map(size => `${fixture}/${folder.name}/${size}.webp`));
      if (removed.error) failures.push(`portadas ${fixture}`);
    }
    }
    for (const id of users) { const result = await a.auth.admin.deleteUser(id); if (result.error) failures.push(`user ${id}`); }
    if (failures.length) throw new Error(`Limpieza pendiente de fixtures ${eventId}: ${failures.join(', ')}`);
  });
  async function image(id: string) {
    const version = randomUUID();
    const webp = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#175137' } }).webp().toBuffer();
    const stage = await a.from('cover_cleanup').insert({ event_id: id, version });
    if (stage.error) throw new Error(stage.error.message);
    for (const size of ['small', 'large']) {
      const uploaded = await a.storage.from('event-covers').upload(`${id}/${version}/${size}.webp`, webp, { contentType: 'image/webp' });
      if (uploaded.error) throw new Error(uploaded.error.message);
    }
    await call(a, 'set_event_cover', { p_actor: users[0], p_event: id, p_expected: null, p_version: version });
    return version;
  }
  it('sells the last place once, checks in once, revokes staff and denies public private-data reads', async () => {
    await call(a, 'save_event', { p_actor: users[0], p_id: eventId, p_data: {
      title: 'Prueba automática', description: 'Fixture temporal', starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      venue: 'Pruebas', address: 'Pruebas', city: 'Huancayo', latitude: -12.06, longitude: -75.2,
      category: 'Prueba', outdoor: false, price_cents: 2500, capacity: 1,
    } });
    const version = await image(eventId);
    const privateImage = await anonymous.storage.from('event-covers').download(`${eventId}/${version}/small.webp`);
    expect(privateImage.error).not.toBeNull();
    await expect(call(b, 'delete_event', { p_actor: users[2], p_event: eventId })).rejects.toThrow('ST:forbidden');
    await call(a, 'publish_event', { p_actor: users[0], p_event: eventId });
    await call(a, 'manage_staff', { p_actor: users[0], p_event: eventId, p_email: `samiticket-staff-${eventId}@example.invalid`, p_remove: false });
    const orderIds = [randomUUID(), randomUUID()];
    for (const id of orderIds) await call(a, 'create_order', { p_id: id, p_event: eventId, p_name: 'Prueba', p_email: 'buyer@example.invalid', p_access_hash: hash });
    const payments = await Promise.allSettled(orderIds.map((id, i) => call(i ? b : a, 'simulate_payment', { p_order: id, p_access_hash: hash, p_approve: true, p_token: randomBytes(32).toString('hex') })));
    expect(payments.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(payments.filter(item => item.status === 'rejected')).toHaveLength(1);
    const tickets = await a.from('tickets').select('token').eq('event_id', eventId);
    expect(tickets.error).toBeNull(); expect(tickets.data).toHaveLength(1);
    const qr = tickets.data![0].token;
    const scans = await Promise.all([a, b].map(client => call(client, 'check_in', { p_actor: users[1], p_event: eventId, p_token: qr })));
    expect(scans.map(item => item.status).sort()).toEqual(['accepted', 'used']);
    await call(a, 'manage_staff', { p_actor: users[0], p_event: eventId, p_email: `samiticket-staff-${eventId}@example.invalid`, p_remove: true });
    await expect(call(b, 'check_in', { p_actor: users[1], p_event: eventId, p_token: qr })).rejects.toThrow('ST:forbidden');
    const denied = await anonymous.from('orders').select('id').eq('event_id', eventId);
    expect(denied.error).not.toBeNull();
    const deniedRPC = await anonymous.rpc('check_in', { p_actor: users[0], p_event: eventId, p_token: qr });
    expect(deniedRPC.error).not.toBeNull();
    await expect(call(b, 'delete_event', { p_actor: users[0], p_event: eventId })).rejects.toThrow('ST:event_has_orders');
  }, 60000);
  it('serializes a new order against event deletion across independent connections', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID(); fixtureEvents.add(id);
      await call(a, 'save_event', { p_actor: users[0], p_id: id, p_data: {
        title: 'Race fixture', description: 'Temporal', starts_at: new Date(Date.now() + 86400000).toISOString(), venue: 'Prueba', address: 'Prueba', city: 'Puno',
        latitude: -15.84, longitude: -70.02, category: 'Prueba', outdoor: false, price_cents: 0, capacity: 1,
      } });
      await image(id); await call(a, 'publish_event', { p_actor: users[0], p_event: id });
      const results = await Promise.allSettled([
        call(a, 'delete_event', { p_actor: users[0], p_event: id }),
        call(b, 'create_order', { p_id: randomUUID(), p_event: id, p_name: 'Prueba', p_email: 'test@example.invalid', p_access_hash: hash }),
      ]);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      const remaining = await a.from('events').select('id').eq('id', id);
      const orders = await a.from('orders').select('id').eq('event_id', id);
      expect(remaining.error).toBeNull(); expect(orders.error).toBeNull();
      expect(remaining.data!.length).toBe(orders.data!.length);
    }
  }, 60000);
});
