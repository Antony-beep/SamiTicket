import { actor, rpc } from '@/lib/server/data';
import { api, body, sameOrigin } from '@/lib/server/http';
import { email, object, uuid } from '@/lib/validation';

async function manage(request: Request, context: RouteContext<'/api/events/[id]/staff'>, remove: boolean) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor();
    const data = object(await body(request));
    await rpc('manage_staff', { p_actor: user, p_event: uuid((await context.params).id), p_email: email(data.email), p_remove: remove });
    return Response.json({ saved: true });
  });
}
export async function POST(request: Request, context: RouteContext<'/api/events/[id]/staff'>) { return manage(request, context, false); }
export async function DELETE(request: Request, context: RouteContext<'/api/events/[id]/staff'>) { return manage(request, context, true); }
