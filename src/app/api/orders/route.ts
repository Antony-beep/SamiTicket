import { database, databaseError, orderAccess, requireDemo, rpc } from '@/lib/server/data';
import { verifyEmail } from '@/lib/server/email';
import { api, body, sameOrigin } from '@/lib/server/http';
import { AppError, buyerInput, object, uuid } from '@/lib/validation';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    requireDemo();
    const data = object(await body(request));
    const id = uuid(data.id);
    const eventId = uuid(data.eventId);
    const { name, email: address } = buyerInput(data);
    const hash = await orderAccess(id);
    const existing = await database().from('orders').select('id').eq('id', id).eq('access_hash', hash).maybeSingle();
    if (existing.error) databaseError(existing.error);
    // A previously verified retry must still work during a verifier outage.
    if (!existing.data) {
      const verification = await verifyEmail(address);
      if (verification.status !== 'accepted') throw new AppError(verification.message, verification.status === 'unknown' ? 503 : 422, { email: verification.message });
    }
    await rpc('create_order', { p_id: id, p_event: eventId, p_name: name, p_email: address, p_access_hash: hash });
    return Response.json({ id, url: `/pedido/${id}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  });
}
