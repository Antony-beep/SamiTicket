import { sendTicketEmail } from '@/lib/server/email';
import { api, sameOrigin } from '@/lib/server/http';
import { uuid } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext<'/api/orders/[id]/email'>) {
  return api(async () => {
    sameOrigin(request);
    const id = uuid((await context.params).id);
    const result = await sendTicketEmail(id);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
