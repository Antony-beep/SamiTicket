import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const staff = '33333333-3333-4333-8333-333333333333';
const unverified = '44444444-4444-4444-8444-444444444444';
const hash = 'a'.repeat(64);
const token = 'b'.repeat(64);
let db: PGlite;
const details = (capacity = 2) => ({ title: 'Noche Andina', description: 'Evento de prueba', starts_at: new Date(Date.now() + 86400000 * 7).toISOString(),
  venue: 'Casa Wanka', address: 'Av. Giráldez 590', city: 'Huancayo', latitude: -12.06, longitude: -75.2,
  category: 'Música', outdoor: false, price_cents: 2500, capacity });
async function event(user = owner, capacity = 2, publish = true) {
  const id = randomUUID();
  await db.query('select public.save_event($1::uuid, $2::uuid, $3::jsonb)', [user, id, JSON.stringify(details(capacity))]);
  if (publish) { await cover(id, user); await db.query('select public.publish_event($1::uuid, $2::uuid)', [user, id]); }
  return id;
}
async function cover(id: string, user = owner, expected: string | null = null) {
  const version = randomUUID();
  await db.query('insert into public.cover_cleanup(event_id,version) values($1,$2)', [id, version]);
  await db.query('select public.set_event_cover($1::uuid,$2::uuid,$3::uuid,$4::uuid)', [user, id, expected, version]);
  return version;
}
async function order(eventId: string, id = randomUUID()) {
  await db.query('select public.create_order($1::uuid, $2::uuid, $3, $4, $5)', [id, eventId, 'Comprador', 'buyer@example.com', hash]);
  return id;
}
async function pay(id: string, approve = true, qr = token, access = hash) {
  return db.query<{ status: string }>('select public.simulate_payment($1::uuid, $2, $3, $4) as status', [id, access, approve, qr]);
}
async function scan(eventId: string, user = staff, qr = token) {
  return db.query<{ result: { status: string } }>('select public.check_in($1::uuid, $2::uuid, $3) as result', [user, eventId, qr]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    grant usage on schema public to service_role;`);
  await db.exec(await readFile('supabase/migrations/202610160001_mvp.sql', 'utf8'));
  const legacy = randomUUID();
  await db.query('insert into auth.users values($1,$2,now())', [owner, 'legacy@example.com']);
  await db.query('select public.save_event($1::uuid,$2::uuid,$3::jsonb)', [owner, legacy, JSON.stringify(details())]);
  await db.query('select public.publish_event($1::uuid,$2::uuid)', [owner, legacy]);
  // Storage's managed schema is represented only for bucket configuration in local SQL tests.
  await db.exec('create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);');
  await db.exec(await readFile('supabase/migrations/202610160002_event_improvements.sql', 'utf8'));
  const preserved = await db.query<{ status: string; cover_version: string | null }>('select status,cover_version from public.events where id=$1', [legacy]);
  expect(preserved.rows[0]).toEqual({ status: 'published', cover_version: null });
  await cover(legacy);
});
beforeEach(async () => {
  await db.exec('reset role; truncate public.cover_cleanup, public.check_ins, public.tickets, public.orders, public.event_staff, public.ticket_types, public.events, auth.users cascade;');
  for (const [id, address, verified] of [[owner, 'owner@example.com', true], [other, 'other@example.com', true], [staff, 'staff@example.com', true], [unverified, 'unverified@example.com', false]]) {
    await db.query('insert into auth.users values ($1::uuid, $2, $3)', [id, address, verified ? new Date().toISOString() : null]);
  }
  await db.exec('set role service_role');
});
afterAll(async () => { await db?.close(); });

describe('MVP PostgreSQL migration and transactions', () => {
  it('isolates owners, saves drafts and freezes published details', async () => {
    const id = await event(owner, 2, false);
    await expect(db.query('select public.save_event($1::uuid, $2::uuid, $3::jsonb)', [null, id, JSON.stringify(details())])).rejects.toThrow('ST:forbidden');
    await expect(db.query('select public.save_event($1::uuid, $2::uuid, $3::jsonb)', [other, id, JSON.stringify(details())])).rejects.toThrow('ST:forbidden');
    await expect(db.query('select public.publish_event($1::uuid, $2::uuid)', [other, id])).rejects.toThrow('ST:forbidden');
    await cover(id);
    await db.query('select public.publish_event($1::uuid, $2::uuid)', [owner, id]);
    await expect(db.query('select public.save_event($1::uuid, $2::uuid, $3::jsonb)', [owner, id, JSON.stringify(details())])).rejects.toThrow('ST:published_immutable');
    await expect(db.query('update public.ticket_types set price_cents = 1 where event_id = $1', [id])).rejects.toThrow('ST:published_immutable');
  });
  it('rejects incomplete and past publication', async () => {
    const id = await event(owner, 1, false);
    await db.query('update public.events set starts_at = now() - interval \'1 day\' where id = $1', [id]);
    await expect(db.query('select public.publish_event($1::uuid, $2::uuid)', [owner, id])).rejects.toThrow('ST:incomplete_event');
    await db.query('update public.events set starts_at = null, title = \'\' where id = $1', [id]);
    await expect(db.query('select public.publish_event($1::uuid, $2::uuid)', [owner, id])).rejects.toThrow('ST:incomplete_event');
  });
  it('publishes only future events and denies public reads and RPC writes of private data', async () => {
    await event(); await event(owner, 2, false);
    await db.exec('set role anon');
    expect((await db.query('select * from public.events')).rows).toHaveLength(1);
    expect((await db.query('select * from public.ticket_types')).rows).toHaveLength(1);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['orders', 'tickets', 'check_ins', 'event_staff']) await expect(db.query(`select * from public.${table}`)).rejects.toThrow('permission denied');
      await expect(db.query('select public.publish_event($1::uuid, $2::uuid)', [owner, randomUUID()])).rejects.toThrow('permission denied');
      await expect(db.query('insert into public.events(owner_id,slug) values($1, $2)', [owner, randomUUID()])).rejects.toThrow('permission denied');
    }
  });
  it('does not reserve stock for pending orders and rejects reuse with different buyer or secret', async () => {
    const id = await event(owner, 1);
    const purchase = await order(id);
    await order(id, purchase);
    expect((await db.query<{ sold: number }>('select sold from public.ticket_types where event_id = $1', [id])).rows[0].sold).toBe(0);
    await expect(db.query('select public.create_order($1::uuid,$2::uuid,$3,$4,$5)', [purchase, id, 'Otro', 'buyer@example.com', hash])).rejects.toThrow('ST:idempotency_conflict');
    await expect(pay(purchase, true, token, 'c'.repeat(64))).rejects.toThrow('ST:receipt_denied');
  });
  it('issues one ticket on retried approval and keeps rejection terminal', async () => {
    const id = await event();
    const purchase = await order(id);
    await Promise.all([pay(purchase), pay(purchase, true, 'c'.repeat(64))]);
    expect((await db.query('select * from public.tickets')).rows).toHaveLength(1);
    expect((await pay(purchase, false)).rows[0].status).toBe('paid');
    const rejected = await order(id);
    expect((await pay(rejected, false)).rows[0].status).toBe('rejected');
    expect((await pay(rejected)).rows[0].status).toBe('rejected');
    expect((await db.query('select * from public.tickets')).rows).toHaveLength(1);
  });
  it('allows only one purchase of the last place and rolls back a ticket failure', async () => {
    const id = await event(owner, 1);
    const first = await order(id); const second = await order(id);
    await expect(pay(first, true, 'invalid')).rejects.toThrow();
    expect((await db.query<{ sold: number }>('select sold from public.ticket_types where event_id = $1', [id])).rows[0].sold).toBe(0);
    const results = await Promise.allSettled([pay(first), pay(second, true, 'c'.repeat(64))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await db.query('select * from public.tickets')).rows).toHaveLength(1);
  });
  it('requires a verified staff account and owner assignment', async () => {
    const id = await event();
    await expect(db.query('select public.manage_staff($1::uuid,$2::uuid,$3,false)', [other, id, 'staff@example.com'])).rejects.toThrow('ST:forbidden');
    for (const address of ['missing@example.com', 'unverified@example.com']) await expect(db.query('select public.manage_staff($1::uuid,$2::uuid,$3,false)', [owner, id, address])).rejects.toThrow('ST:unregistered_staff');
  });
  it('accepts one check-in, identifies wrong/invalid QR and applies revocation', async () => {
    const id = await event(); const another = await event();
    const purchase = await order(id); await pay(purchase);
    await expect(scan(id)).rejects.toThrow('ST:forbidden');
    await db.query('select public.manage_staff($1::uuid,$2::uuid,$3,false)', [owner, id, 'staff@example.com']);
    const results = await Promise.all([scan(id), scan(id)]);
    expect(results.map(result => result.rows[0].result.status).sort()).toEqual(['accepted', 'used']);
    expect((await scan(id, staff, 'd'.repeat(64))).rows[0].result.status).toBe('invalid');
    expect((await scan(another, owner)).rows[0].result.status).toBe('wrong_event');
    await db.query('select public.manage_staff($1::uuid,$2::uuid,$3,true)', [owner, id, 'staff@example.com']);
    await expect(scan(id)).rejects.toThrow('ST:forbidden');
    expect((await scan(id, owner)).rows[0].result.status).toBe('used');
  });
});

describe('event improvements migration', () => {
  it('requires a cover for new publications, permits owner replacement only, and queues obsolete variants', async () => {
    const id = await event(owner, 2, false);
    await expect(db.query('select public.publish_event($1::uuid,$2::uuid)', [owner, id])).rejects.toThrow('ST:incomplete_event');
    const old = await cover(id);
    await db.query('select public.publish_event($1::uuid,$2::uuid)', [owner, id]);
    await expect(cover(id, other, old)).rejects.toThrow('ST:forbidden');
    const next = await cover(id, owner, old);
    expect((await db.query<{ cover_version: string }>('select cover_version from public.events where id=$1', [id])).rows[0].cover_version).toBe(next);
    expect((await db.query('select * from public.cover_cleanup where event_id=$1 and version=$2', [id, old])).rows).toHaveLength(1);
    await expect(cover(id, owner, old)).rejects.toThrow('ST:cover_conflict');
    await expect(db.query('select public.set_event_cover($1::uuid,$2::uuid,$3::uuid,null)', [owner, id, next])).rejects.toThrow('ST:published_immutable');
    await expect(db.query("update public.events set reference='changed' where id=$1", [id])).rejects.toThrow('ST:published_immutable');
  });
  it('allows clearing a draft cover and deleting only by its owner', async () => {
    const id = await event(owner, 2, false), version = await cover(id);
    await db.query('select public.set_event_cover($1::uuid,$2::uuid,$3::uuid,null)', [owner, id, version]);
    await expect(db.query('select public.delete_event($1::uuid,$2::uuid)', [other, id])).rejects.toThrow('ST:forbidden');
    await db.query('select public.manage_staff($1::uuid,$2::uuid,$3,false)', [owner, id, 'staff@example.com']);
    await expect(db.query('select public.delete_event($1::uuid,$2::uuid)', [staff, id])).rejects.toThrow('ST:forbidden');
    await db.query('select public.delete_event($1::uuid,$2::uuid)', [owner, id]);
    for (const table of ['events', 'event_staff', 'ticket_types']) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
  });
  it.each(['pending', 'paid', 'rejected'])('blocks deletion when an order is %s', async status => {
    const id = await event(), purchase = await order(id);
    if (status !== 'pending') await pay(purchase, status === 'paid');
    await expect(db.query('select public.delete_event($1::uuid,$2::uuid)', [owner, id])).rejects.toThrow('ST:event_has_orders');
    expect((await db.query('select * from public.events where id=$1', [id])).rows).toHaveLength(1);
  });
  it('deletes an unsold published event and prevents a subsequent order', async () => {
    const id = await event();
    await db.query('select public.delete_event($1::uuid,$2::uuid)', [owner, id]);
    await expect(order(id)).rejects.toThrow('ST:event_unavailable');
    expect((await db.query('select * from public.cover_cleanup where event_id=$1', [id])).rows).toHaveLength(1);
  });
  it('keeps cleanup jobs and cover writes inaccessible to public clients', async () => {
    await db.exec('set role anon');
    await expect(db.query('select * from public.cover_cleanup')).rejects.toThrow('permission denied');
    await expect(db.query('select public.delete_event($1::uuid,$2::uuid)', [owner, randomUUID()])).rejects.toThrow('permission denied');
  });
});
