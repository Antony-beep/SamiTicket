import { checkoutURL } from '@/lib/server/mercadopago';
import { api, sameOrigin } from '@/lib/server/http';
import { uuid } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext<'/api/orders/[id]/checkout'>) {
  return api(async () => {
    sameOrigin(request);
    const id = uuid((await context.params).id);
    return Response.json({ url: await checkoutURL(id) }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
