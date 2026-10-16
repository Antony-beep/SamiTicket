import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  cookie: '1'.repeat(64), rows: {} as Record<string, unknown>,
  rpc: vi.fn(), setCookie: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined, set: state.setCookie }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } }, error: null }) } }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  rpc: state.rpc,
  from: (table: string) => {
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: state.rows[table] ?? null, error: null }),
      single: async () => ({ data: state.rows[table] ?? null, error: null }) };
    return query;
  },
}) }));
import { receipt, receiptHash } from '@/lib/server/data';
import { POST as createOrder } from '@/app/api/orders/route';
import { POST as simulate } from '@/app/api/orders/[id]/simulate/route';
import { POST as checkIn } from '@/app/api/events/[id]/check-in/route';
import { POST as checkoutSession } from '@/app/api/orders/session/route';
import { GET as downloadQR } from '@/app/api/orders/[id]/qr/route';
const id = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';
const token = 'b'.repeat(64);
const context = { params: Promise.resolve({ id }) };
function request(path: string, data: unknown = {}, origin = 'http://localhost:3000') {
  return new Request(`http://localhost:3000${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
function paidOrder() {
  state.rows.orders = { id, event_id: eventId, buyer_name: 'Comprador', buyer_email: 'buyer@example.com', amount_cents: 2500, status: 'paid', access_hash: receiptHash(state.cookie, id) };
  state.rows.events = { title: 'Evento', venue: 'Local', address: 'Dirección', starts_at: new Date().toISOString(), slug: 'evento-demo' };
  state.rows.tickets = { token };
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only'); vi.stubEnv('DEMO_PAYMENTS_ENABLED', 'true');
  state.cookie = '1'.repeat(64); state.rows = {}; state.rpc.mockReset(); state.setCookie.mockReset();
  state.rpc.mockResolvedValue({ data: id, error: null });
});
describe('HTTP boundaries and private receipts', () => {
  it('denies cross-origin writes and disabled demo payments', async () => {
    expect((await createOrder(request('/api/orders', {}, 'https://evil.test'))).status).toBe(403);
    vi.stubEnv('DEMO_PAYMENTS_ENABLED', 'false');
    expect((await simulate(request(`/api/orders/${id}/simulate`, { approve: true }), context)).status).toBe(403);
    expect((await createOrder(request('/api/orders'))).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('revalidates email before order creation and fails closed on verifier outage', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ disposable: true }));
    const input = { id, eventId, name: 'Comprador', email: 'test@yopmail.com' };
    expect((await createOrder(request('/api/orders', input))).status).toBe(422);
    expect(state.rpc).not.toHaveBeenCalled();
    fetcher.mockRejectedValue(new Error('offline'));
    expect((await createOrder(request('/api/orders', input))).status).toBe(503);
    expect(state.rpc).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(Response.json({ disposable: false, format: true, dns: true }));
    expect((await createOrder(request('/api/orders', input))).status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith('create_order', expect.objectContaining({ p_id: id, p_email: 'test@yopmail.com', p_access_hash: receiptHash(state.cookie, id) }));
  });
  it('sets a private checkout cookie and preserves existing session secrets', async () => {
    state.cookie = '';
    expect((await checkoutSession(request('/api/orders/session'))).status).toBe(200);
    expect(state.setCookie).toHaveBeenCalledWith('samiticket_checkout', expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }));
    state.cookie = '2'.repeat(64); state.setCookie.mockClear();
    await checkoutSession(request('/api/orders/session'));
    expect(state.setCookie).not.toHaveBeenCalled();
  });
  it('allows a receipt only with its independent browser secret', async () => {
    paidOrder();
    expect((await receipt(id)).token).toBe(token);
    state.cookie = '2'.repeat(64);
    await expect(receipt(id)).rejects.toThrow('no está disponible');
    state.cookie = token;
    await expect(receipt(id)).rejects.toThrow('no está disponible');
    state.cookie = '';
    await expect(receipt(id)).rejects.toThrow('navegador');
  });
  it('downloads a real PNG without cache and denies access from another browser', async () => {
    paidOrder();
    const response = await downloadQR(new Request(`http://localhost:3000/api/orders/${id}/qr`), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    state.cookie = '3'.repeat(64);
    expect((await downloadQR(new Request(`http://localhost:3000/api/orders/${id}/qr`), context)).status).toBe(403);
  });
  it('uses the authenticated actor for check-in and reports malformed QR', async () => {
    const eventContext = { params: Promise.resolve({ id: eventId }) };
    state.rpc.mockResolvedValueOnce({ data: { status: 'invalid' }, error: null });
    const malformed = await checkIn(request(`/api/events/${eventId}/check-in`, { token: 'bad' }), eventContext);
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual(expect.objectContaining({ errors: { token: expect.any(String) } }));
    expect(state.rpc).not.toHaveBeenCalled();
    await checkIn(request(`/api/events/${eventId}/check-in`, { token, actor: 'attacker' }), eventContext);
    expect(state.rpc).toHaveBeenCalledWith('check_in', { p_actor: '11111111-1111-4111-8111-111111111111', p_event: eventId, p_token: token });
  });
});
