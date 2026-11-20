import { database, databaseError, orderAccess, requireDemo, resumableMercadoPagoOrder, rpc } from '@/lib/server/data';
import { verifyEmail } from '@/lib/server/email';
import { api, body, sameOrigin } from '@/lib/server/http';
import { AppError, buyerInput, object, uuid } from '@/lib/validation';
import { createMercadoPagoOrder, mercadoPagoEnabled } from '@/lib/server/mercadopago';
import { reniecVerificationEnabled, verifyReniecToken } from '@/lib/server/reniec';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const useMercadoPago = mercadoPagoEnabled();
    if (!useMercadoPago) requireDemo();
    const data = object(await body(request));
    const id = uuid(data.id);
    const eventId = uuid(data.eventId);
    const verifiedReniec = reniecVerificationEnabled() || data.reniecToken
      ? verifyReniecToken(data.reniecToken)
      : null;
    const { name, email: address } = buyerInput({
      ...data,
      ...(verifiedReniec ? { name: verifiedReniec.name } : {}),
    });
    const hash = await orderAccess(id);
    if (useMercadoPago) {
      const resumedId = await resumableMercadoPagoOrder(eventId, address);
      if (resumedId) return Response.json({ id: resumedId, url: `/pedido/${resumedId}` }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const existing = await database().from('orders').select('id').eq('id', id).eq('access_hash', hash).maybeSingle();
    if (existing.error) databaseError(existing.error);
    // A previously verified retry must still work during a verifier outage.
    if (!existing.data) {
      const verification = await verifyEmail(address);
      if (verification.status !== 'accepted') throw new AppError(verification.message, verification.status === 'unknown' ? 503 : 422, { email: verification.message });
    }
    if (useMercadoPago) {
      await createMercadoPagoOrder({ id, eventId, name, email: address, hash });
    } else {
      await rpc('create_order', { p_id: id, p_event: eventId, p_name: name, p_email: address, p_access_hash: hash });
    }
    if (verifiedReniec) {
      await rpc('set_order_dni', { p_order: id, p_access_hash: hash, p_dni: verifiedReniec.dni });
    }
    return Response.json({ id, url: `/pedido/${id}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  });
}
