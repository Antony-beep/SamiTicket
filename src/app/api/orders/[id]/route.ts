import { receipt } from '@/lib/server/data';
import { api } from '@/lib/server/http';

export async function GET(_request: Request, context: RouteContext<'/api/orders/[id]'>) {
  return api(async () => Response.json(await receipt((await context.params).id), {
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  }));
}
