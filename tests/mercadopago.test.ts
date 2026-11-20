import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as webhook } from '@/app/api/payments/mercadopago/route';
import { checkoutURL, refreshOrderPayment, simulateMercadoPagoPayment, verifyNotification, paymentMatchesOrder } from '@/lib/server/mercadopago';
import { AppError } from '@/lib/validation';

const mocks = vi.hoisted(() => ({
  attempts: [] as { payment_id: string; state: string }[],
  database: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: mocks.attempts, error: null }),
        }),
      }),
    }),
  })),
  databaseError: vi.fn(),
  orderAccess: vi.fn(),
  privateOrder: vi.fn(),
  requireDemo: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/lib/server/data', () => mocks);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('Mercado Pago trust boundaries', () => {
  it('returns 404 when a properly signed notification points to a payment the provider cannot find', async () => {
    vi.stubEnv('MP_PAYMENTS_ENABLED', 'true');
    vi.stubEnv('MP_ENVIRONMENT', 'test');
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-seller-webhook-fixture');
    vi.stubEnv('MP_TEST_SELLER_ID', '44');
    vi.stubEnv('MP_WEBHOOK_SECRET', 'test-secret');
    const provider = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 44, site_id: 'MPE', tags: ['test_user'] }))
      .mockResolvedValueOnce(Response.json({ message: 'Payment not found' }, { status: 404 }));
    vi.stubGlobal('fetch', provider);
    const ts = String(Date.now());
    const digest = createHmac('sha256', 'test-secret').update(`id:123456;request-id:simulation;ts:${ts};`).digest('hex');
    const response = await webhook(new Request('https://test.example/api/payments/mercadopago?data.id=123456', {
      method: 'POST', headers: { 'x-request-id': 'simulation', 'x-signature': `ts=${ts},v1=${digest}` },
    }));
    expect(provider).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('opens a reserved test checkout even when the webhook is not yet configured', async () => {
    vi.stubEnv('MP_PAYMENTS_ENABLED', 'true');
    vi.stubEnv('MP_ENVIRONMENT', 'test');
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-seller-fixture');
    vi.stubEnv('MP_TEST_SELLER_ID', '44');
    vi.stubEnv('APP_URL', 'https://example.com');
    vi.stubEnv('MP_WEBHOOK_SECRET', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 44, site_id: 'MPE', tags: ['test_user'] })));
    const url = 'https://www.mercadopago.com.pe/checkout';
    mocks.orderAccess.mockResolvedValue('order-hash');
    mocks.rpc.mockResolvedValue({ url });
    await expect(checkoutURL('order-1')).resolves.toBe(url);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_mp_checkout', { p_order: 'order-1', p_access_hash: 'order-hash' });
  });

  it('checks private order access before making any query to Mercado Pago', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    vi.stubEnv('MP_PAYMENTS_ENABLED', 'false');
    mocks.orderAccess.mockResolvedValue('foreign-hash');
    mocks.privateOrder.mockRejectedValue(new AppError('Comprobante privado.', 403));
    await expect(refreshOrderPayment('order-1')).rejects.toMatchObject({ status: 403 });
    expect(provider).not.toHaveBeenCalled();
  });

  it('verifies the signed query id and rejects modified or expired notifications', () => {
    vi.stubEnv('MP_WEBHOOK_SECRET', 'test-secret');
    const ts = String(Date.now());
    const digest = createHmac('sha256', 'test-secret').update(`id:123;request-id:request-1;ts:${ts};`).digest('hex');
    const request = (id = '123') => new Request(`https://test.example/api/payments/mercadopago?data.id=${id}`, {
      headers: { 'x-request-id': 'request-1', 'x-signature': `ts=${ts},v1=${digest}` },
    });
    expect(verifyNotification(request())).toBe('123');
    expect(() => verifyNotification(request('456'))).toThrow();
    expect(() => verifyNotification(new Request('https://test.example/?data.id=123'))).toThrow();
    const expired = String(Date.now() - 301000);
    const oldDigest = createHmac('sha256', 'test-secret').update(`id:123;request-id:request-1;ts:${expired};`).digest('hex');
    expect(() => verifyNotification(new Request('https://test.example/?data.id=123', {
      headers: { 'x-request-id': 'request-1', 'x-signature': `ts=${expired},v1=${oldDigest}` },
    }))).toThrow();
    vi.stubEnv('MP_WEBHOOK_SECRET', 'preview');
    expect(() => verifyNotification(request())).toThrow('firma completa');
  });

  it('matches trusted cents, currency, seller and order reference', () => {
    const payment = { id: 123, collector_id: 44, transaction_amount: 25, currency_id: 'PEN', external_reference: 'order-1', status: 'approved' };
    const order = { id: 'order-1', amountCents: 2500, sellerId: '44' };
    expect(paymentMatchesOrder(payment, order)).toBe(true);
    expect(paymentMatchesOrder({ ...payment, transaction_amount: 0.25 }, order)).toBe(false);
    expect(paymentMatchesOrder({ ...payment, collector_id: 45 }, order)).toBe(false);
    expect(paymentMatchesOrder({ ...payment, currency_id: 'USD' }, order)).toBe(false);
    expect(paymentMatchesOrder({ ...payment, external_reference: 'other' }, order)).toBe(false);
  });

  it('simulates Mercado Pago test states locally while reusing in-process or approved payment IDs', async () => {
    vi.stubEnv('MP_PAYMENTS_ENABLED', 'true');
    vi.stubEnv('MP_ENVIRONMENT', 'test');
    vi.stubEnv('MP_TEST_SELLER_ID', '44');
    mocks.privateOrder.mockResolvedValue({ id: 'order-1', amount_cents: 1500, payment_mode: 'mp_test' });
    mocks.attempts = [{ payment_id: '90001', state: 'in_process' }];
    mocks.rpc.mockResolvedValueOnce('paid');
    await expect(simulateMercadoPagoPayment('order-1', 'approved')).resolves.toBe('paid');
    expect(mocks.rpc).toHaveBeenCalledWith('reconcile_mp_payment', expect.objectContaining({
      p_order: 'order-1', p_payment: '90001', p_seller: '44', p_amount: 1500, p_state: 'approved',
    }));

    mocks.attempts = [{ payment_id: '90001', state: 'approved' }];
    mocks.rpc.mockResolvedValueOnce('refunded');
    await expect(simulateMercadoPagoPayment('order-1', 'refunded')).resolves.toBe('refunded');
    expect(mocks.rpc).toHaveBeenLastCalledWith('reconcile_mp_payment', expect.objectContaining({
      p_order: 'order-1', p_payment: '90001', p_state: 'refunded',
    }));
  });
});
