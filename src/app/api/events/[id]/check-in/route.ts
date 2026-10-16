import { actor, rpc } from '@/lib/server/data';
import { api, body, sameOrigin } from '@/lib/server/http';
import { object, qrToken, uuid } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext<'/api/events/[id]/check-in'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor();
    const data = object(await body(request));
    const token = qrToken(data.token);
    const result = await rpc('check_in', { p_actor: user, p_event: uuid((await context.params).id), p_token: token });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  });
}
