import { actor, rpc } from '@/lib/server/data';
import { api, body, sameOrigin } from '@/lib/server/http';
import { eventInput, object, uuid } from '@/lib/validation';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor();
    const data = object(await body(request));
    const id = uuid(data.id);
    await rpc('save_event', { p_actor: user, p_id: id, p_data: eventInput(data) });
    return Response.json({ id }, { status: 201 });
  });
}
