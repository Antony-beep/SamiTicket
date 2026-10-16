import { actor, authorizedEvent, rpc } from '@/lib/server/data';
import { api, sameOrigin } from '@/lib/server/http';
import { AppError, publicationErrors, uuid } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext<'/api/events/[id]/publish'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor(), id = uuid((await context.params).id);
    const event = await authorizedEvent(id, user, true);
    if (event.status === 'draft') {
      const errors = publicationErrors(event, Boolean(event.coverLargeUrl));
      if (Object.keys(errors).length) throw new AppError('Completa los campos para publicar.', 400, errors);
    }
    await rpc('publish_event', { p_actor: user, p_event: id });
    return Response.json({ published: true });
  });
}
