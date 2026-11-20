import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { checkoutCookie, requireDemo } from '@/lib/server/data';
import { api, sameOrigin } from '@/lib/server/http';
import { mercadoPagoEnabled } from '@/lib/server/mercadopago';

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    if (!mercadoPagoEnabled()) requireDemo();
    const store = await cookies();
    const previous = store.get(checkoutCookie)?.value;
    const valid = /^[a-f0-9]{64}$/.test(previous ?? '');
    if (!valid || mercadoPagoEnabled()) {
      store.set(checkoutCookie, valid ? previous! : randomBytes(32).toString('hex'), {
        httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: mercadoPagoEnabled() ? 'lax' : 'strict', path: '/', maxAge: 30 * 86400,
      });
    }
    return Response.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
