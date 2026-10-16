import { verifyEmail } from '@/lib/server/email';
import { api, body, sameOrigin } from '@/lib/server/http';
import { object } from '@/lib/validation';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return Response.json(await verifyEmail(object(await body(request)).email), { headers: { 'Cache-Control': 'no-store' } });
  });
}
