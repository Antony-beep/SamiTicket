// Public tunnel target for the payment demo. The rest of the Next.js app stays private.
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

process.loadEnvFile('.env.local');
const orderPath = /^\/return\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const returnedOrder = url.pathname.match(orderPath);
  if (request.method === 'GET' && returnedOrder) {
    response.writeHead(303, { Location: `http://localhost:3000/pedido/${returnedOrder[1]}?retorno=mercadopago`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    response.end();
    return;
  }
  if (request.method !== 'POST' || url.pathname !== '/api/payments/mercadopago') {
    response.writeHead(404);
    response.end();
    return;
  }
  const secret = parseEnv(readFileSync('.env.local', 'utf8')).MP_WEBHOOK_SECRET;
  if (!secret || secret.length <= 7) {
    response.writeHead(503);
    response.end();
    return;
  }
  const id = url.searchParams.get('data.id');
  const requestId = request.headers['x-request-id'];
  const signature = Object.fromEntries(String(request.headers['x-signature'] ?? '').split(',').map(part => part.trim().split('=')));
  const timestamp = Number(signature.ts);
  const time = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const valid = id && /^\d{1,30}$/.test(id) && typeof requestId === 'string' && requestId.length <= 200 &&
    /^\d+$/.test(signature.ts ?? '') && /^[a-f0-9]{64}$/i.test(signature.v1 ?? '') && Math.abs(Date.now() - time) <= 300000;
  if (!valid) {
    response.writeHead(401);
    response.end();
    return;
  }
  const expected = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${signature.ts};`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.v1, 'hex'))) {
    response.writeHead(401);
    response.end();
    return;
  }
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20000) {
      response.writeHead(413);
      response.end();
      return;
    }
  }
  try {
    const upstream = await fetch(`http://localhost:3000/api/payments/mercadopago?data.id=${id}`, {
      method: 'POST', headers: { 'x-request-id': requestId, 'x-signature': request.headers['x-signature'] },
      signal: AbortSignal.timeout(18000),
    });
    response.writeHead(upstream.status, { 'Cache-Control': 'no-store' });
    response.end();
  } catch {
    response.writeHead(503);
    response.end();
  }
}).listen(3101, '127.0.0.1', () => console.log('MP signed-webhook gateway listening on 127.0.0.1:3101'));
