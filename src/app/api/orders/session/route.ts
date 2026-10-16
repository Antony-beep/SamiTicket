import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { checkoutCookie, requireDemo } from '@/lib/server/data';
import { api, sameOrigin } from '@/lib/server/http';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    requireDemo();
    const store = await cookies();
    if (!/^[a-f0-9]{64}$/.test(store.get(checkoutCookie)?.value ?? '')) {
      store.set(checkoutCookie, randomBytes(32).toString('hex'), {
        httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'strict', path: '/', maxAge: 30 * 86400,
      });
    }
    return Response.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
