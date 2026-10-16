import { actor, authorizedEvent, rpc } from '@/lib/server/data';
import { api, body, sameOrigin } from '@/lib/server/http';
import { eventInput, uuid } from '@/lib/validation';
import { cleanupCovers } from '@/lib/server/covers';

export async function GET(_request: Request, context: RouteContext<'/api/events/[id]'>) {
  return api(async () => Response.json(await authorizedEvent((await context.params).id, await actor(), true), { headers: { 'Cache-Control': 'no-store' } }));
}
export async function DELETE(request: Request, context: RouteContext<'/api/events/[id]'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor(), id = uuid((await context.params).id);
    await rpc('delete_event', { p_actor: user, p_event: id });
    return Response.json({ deleted: true, cleanupPending: !(await cleanupCovers(id)) });
  });
}
export async function PATCH(request: Request, context: RouteContext<'/api/events/[id]'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor();
    const id = uuid((await context.params).id);
    await rpc('save_event', { p_actor: user, p_id: id, p_data: eventInput(await body(request)) });
    return Response.json({ id });
  });
}
