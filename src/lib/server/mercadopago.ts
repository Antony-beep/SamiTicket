import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, MPNotFoundError, Payment, PaymentRefund, Preference } from 'mercadopago';
import { AppError } from '@/lib/validation';
import { database, databaseError, orderAccess, privateOrder, requireDemo, rpc } from './data';

type ProviderPayment = {
  id?: number | string; collector_id?: number; transaction_amount?: number;
  currency_id?: string; external_reference?: string; status?: string; captured?: boolean;
};

export function mercadoPagoEnabled() {
  return process.env.MP_PAYMENTS_ENABLED === 'true';
}

let verifiedSeller: { token: string; expiresAt: number } | undefined;

async function testClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  const seller = process.env.MP_TEST_SELLER_ID;
  if (!mercadoPagoEnabled() || process.env.MP_ENVIRONMENT !== 'test' || !token || !seller) {
    throw new AppError('Mercado Pago de prueba no está configurado.', 503);
  }
  if (verifiedSeller?.token !== token || verifiedSeller.expiresAt < Date.now()) {
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new AppError('No pudimos verificar el vendedor de prueba. Reintenta.', 503);
    const user = await response.json();
    if (String(user.id) !== seller || user.site_id !== 'MPE' || !user.tags?.includes('test_user')) {
      throw new AppError('Se requiere la cuenta vendedora ficticia de Perú. Los cobros reales están bloqueados.', 503);
    }
    verifiedSeller = { token, expiresAt: Date.now() + 60000 };
  }
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 10000 } });
}

function appURL() {
  const raw = process.env.APP_URL;
  if (!raw) throw new AppError('Falta configurar APP_URL para recibir el retorno del pago.', 503);
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new AppError('APP_URL debe ser el origen HTTPS público de la demo.', 503);
  }
  return url.origin;
}

export function verifyNotification(request: Request) {
  const id = new URL(request.url).searchParams.get('data.id');
  const secret = process.env.MP_WEBHOOK_SECRET;
  const requestId = request.headers.get('x-request-id');
  const signature = request.headers.get('x-signature') ?? '';
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  const timestamp = Number(parts.ts);
  const timeMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (!secret || secret.length <= 7) throw new AppError('Falta configurar la firma completa de Mercado Pago.', 503);
  if (!id || !/^\d{1,30}$/.test(id) || !requestId || requestId.length > 200 ||
    !/^\d+$/.test(parts.ts ?? '') || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? '') ||
    !Number.isFinite(timeMs) || Math.abs(Date.now() - timeMs) > 300000) {
    throw new AppError('Notificación no válida.', 401);
  }
  const expected = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${parts.ts};`).digest();
  if (!timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'))) throw new AppError('Firma no válida.', 401);
  return id;
}

export function paymentMatchesOrder(payment: ProviderPayment, order: { id: string; amountCents: number; sellerId: string }) {
  const amount = payment.transaction_amount;
  return typeof amount === 'number' && Number.isFinite(amount) &&
    amount === order.amountCents / 100 && payment.currency_id === 'PEN' &&
    String(payment.collector_id) === order.sellerId && payment.external_reference === order.id;
}

export async function createMercadoPagoOrder(input: { id: string; eventId: string; name: string; email: string; hash: string }) {
  await testClient();
  appURL();
  return rpc('create_mp_order', {
    p_id: input.id, p_event: input.eventId, p_name: input.name, p_email: input.email,
    p_access_hash: input.hash, p_seller: process.env.MP_TEST_SELLER_ID,
  });
}

export async function checkoutURL(orderId: string) {
  const hash = await orderAccess(orderId);
  const client = await testClient();
  const origin = appURL();
  const checkout = await rpc<{
    url?: string; creationKey: string; expiresAt: string; sellerId: string; amountCents: number; title: string;
  }>('claim_mp_checkout', { p_order: orderId, p_access_hash: hash });
  if (checkout.url) return checkout.url;
  if (checkout.sellerId !== process.env.MP_TEST_SELLER_ID) throw new AppError('El vendedor no coincide.', 409);
  const preferences = new Preference(client);
  // Reconcile a response lost after creation before submitting the same idempotent request again.
  const existing = await preferences.search({ options: { external_reference: orderId } });
  const found = existing.elements?.find(item => item.external_reference === orderId);
  const preference = found?.id ? await preferences.get({ preferenceId: found.id }) : await preferences.create({
    requestOptions: { idempotencyKey: checkout.creationKey },
    body: {
      items: [{ id: orderId, title: `${checkout.title} · PRUEBA`, quantity: 1, currency_id: 'PEN', unit_price: checkout.amountCents / 100 }],
      external_reference: orderId,
      metadata: { samiticket_order_id: orderId, environment: 'test' },
      back_urls: { success: `${origin}/return/${orderId}`, pending: `${origin}/return/${orderId}`, failure: `${origin}/return/${orderId}` },
      notification_url: `${origin}/api/payments/mercadopago`,
      expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: checkout.expiresAt,
      payment_methods: { installments: 1, excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
    },
  });
  if (!preference.id || !preference.init_point || String(preference.collector_id) !== checkout.sellerId) {
    throw new AppError('No pudimos preparar el checkout de prueba. Reintenta.', 503);
  }
  const url = new URL(preference.init_point);
  if (url.protocol !== 'https:' || !['www.mercadopago.com.pe', 'www.mercadopago.com', 'mercadopago.com.pe'].includes(url.hostname)) {
    throw new AppError('Mercado Pago devolvió un destino no válido.', 503);
  }
  return rpc<string>('save_mp_checkout', { p_order: orderId, p_preference: preference.id, p_url: preference.init_point });
}

export async function reconcilePayment(paymentId: string, expectedOrder?: string) {
  if (!/^\d{1,30}$/.test(paymentId)) throw new AppError('Identificador de pago inválido.');
  const client = await testClient();
  const payment = await new Payment(client).get({ id: paymentId }).catch((error: unknown) => {
    if (error instanceof MPNotFoundError) throw new AppError('Mercado Pago no encontró el pago indicado.', 404);
    throw error;
  });
  const orderId = payment.external_reference;
  if (!orderId || (expectedOrder && orderId !== expectedOrder)) throw new AppError('El pago no corresponde a esta orden.', 409);
  const { data: order, error } = await database().from('orders').select('id,amount_cents,payment_mode').eq('id', orderId).maybeSingle();
  if (error) databaseError(error);
  if (!order || order.payment_mode !== 'mp_test' || !paymentMatchesOrder(payment, {
    id: order.id, amountCents: order.amount_cents, sellerId: process.env.MP_TEST_SELLER_ID!,
  })) throw new AppError('El pago no coincide con la compra.', 409);
  if (payment.status === 'approved' && payment.captured === false) return 'pending';
  if (!payment.status) throw new AppError('No pudimos consultar el estado del pago.', 503);
  const result = await rpc<string>('reconcile_mp_payment', {
    p_order: orderId, p_payment: paymentId, p_seller: String(payment.collector_id),
    p_amount: order.amount_cents, p_state: payment.status, p_token: randomBytes(32).toString('hex'),
  });
  if (result === 'refund_required') {
    if (payment.status !== 'refunded') {
      const refund = await new PaymentRefund(client).total({ payment_id: paymentId, requestOptions: { idempotencyKey: `samiticket-refund-${paymentId}` } });
      if (refund.status !== 'approved') throw new AppError('El reembolso de prueba está pendiente de confirmación.', 503);
    }
    await rpc('confirm_mp_refund', { p_payment: paymentId });
    return 'refunded';
  }
  return result;
}

export async function refreshOrderPayment(orderId: string) {
  const order = await privateOrder(orderId);
  if (order.payment_mode !== 'mp_test') throw new AppError('Esta compra no tiene un checkout de Mercado Pago.', 409);
  const client = await testClient();
  let offset = 0;
  let total = 0;
  do {
    const payments = await new Payment(client).search({ options: { external_reference: orderId, sort: 'date_created', criteria: 'asc', limit: 50, offset } });
    for (const payment of payments.results ?? []) {
      if (payment.id) await reconcilePayment(String(payment.id), orderId);
    }
    offset += payments.results?.length ?? 0;
    total = payments.paging?.total ?? 0;
    if (!payments.results?.length) break;
  } while (offset < total);
}

export type SimulatedMPState = 'approved' | 'in_process' | 'rejected' | 'refunded';

export async function simulateMercadoPagoPayment(orderId: string, state: SimulatedMPState) {
  requireDemo();
  const seller = process.env.MP_TEST_SELLER_ID;
  if (!mercadoPagoEnabled() || process.env.MP_ENVIRONMENT !== 'test' || !seller) {
    throw new AppError('Mercado Pago de prueba no está configurado.', 503);
  }
  const order = await privateOrder(orderId);
  if (order.payment_mode !== 'mp_test') throw new AppError('Esta compra no tiene un checkout de Mercado Pago.', 409);
  const { data: attempts, error } = await database().from('mp_payments').select('payment_id,state').eq('order_id', orderId).order('updated_at', { ascending: false });
  if (error) databaseError(error);
  const list = attempts ?? [];
  let paymentId: string | undefined;
  if (state === 'refunded') {
    paymentId = list.find(item => item.state === 'approved')?.payment_id;
    if (!paymentId) throw new AppError('No hay un pago aprobado para reembolsar en esta orden.', 409);
  } else {
    paymentId = list.find(item => ['pending', 'in_process', 'authorized'].includes(item.state))?.payment_id
      ?? `9${BigInt(`0x${randomBytes(7).toString('hex')}`).toString().padStart(17, '0')}`;
  }
  const result = await rpc<string>('reconcile_mp_payment', {
    p_order: orderId, p_payment: paymentId, p_seller: seller,
    p_amount: order.amount_cents, p_state: state, p_token: randomBytes(32).toString('hex'),
  });
  if (result === 'refund_required') {
    await rpc('confirm_mp_refund', { p_payment: paymentId });
    return 'refunded';
  }
  return result;
}
