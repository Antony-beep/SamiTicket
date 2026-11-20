import { randomBytes } from 'node:crypto';
import { orderAccess, requireDemo, rpc } from '@/lib/server/data';
import { simulateMercadoPagoPayment, type SimulatedMPState } from '@/lib/server/mercadopago';
import { api, body, sameOrigin } from '@/lib/server/http';
import { AppError, object, uuid } from '@/lib/validation';

const mpStates: readonly SimulatedMPState[] = ['approved', 'in_process', 'rejected', 'refunded'];

export async function POST(request: Request, context: RouteContext<'/api/orders/[id]/simulate'>) {
  return api(async () => {
    sameOrigin(request);
    requireDemo();
    const id = uuid((await context.params).id);
    const data = object(await body(request));
    if (typeof data.state === 'string') {
      if (!mpStates.includes(data.state as SimulatedMPState)) throw new AppError('Selecciona un estado de prueba válido.');
      const status = await simulateMercadoPagoPayment(id, data.state as SimulatedMPState);
      return Response.json({ status }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (typeof data.approve !== 'boolean') throw new AppError('Selecciona el resultado del pago simulado.');
    const status = await rpc('simulate_payment', { p_order: id, p_access_hash: await orderAccess(id), p_approve: data.approve, p_token: randomBytes(32).toString('hex') });
    return Response.json({ status }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
