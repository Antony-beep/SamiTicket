import { api, body, sameOrigin } from '@/lib/server/http';
import { checkReniecStatus, createReniecRequest, lookupReniecDni, simulateReniecVerification } from '@/lib/server/reniec';
import { object } from '@/lib/validation';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const data = object(await body(request));
    const action = typeof data.action === 'string' ? data.action : 'start';
    if (action === 'simulate') {
      return Response.json(simulateReniecVerification(), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'lookup') {
      return Response.json(await lookupReniecDni(data.dni), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'status') {
      return Response.json(await checkReniecStatus(data.sessionToken), { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(await createReniecRequest(), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  });
}
