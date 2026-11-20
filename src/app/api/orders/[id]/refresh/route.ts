import { refreshOrderPayment } from '@/lib/server/mercadopago';
import { receipt } from '@/lib/server/data';
import { api, sameOrigin } from '@/lib/server/http';
import { uuid } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext<'/api/orders/[id]/refresh'>) {
  return api(async () => {
    sameOrigin(request);
    const id = uuid((await context.params).id);
    await refreshOrderPayment(id);
    return Response.json(await receipt(id), { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
