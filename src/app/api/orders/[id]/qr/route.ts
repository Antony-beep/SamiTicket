import QRCode from 'qrcode';
import { receipt } from '@/lib/server/data';
import { api } from '@/lib/server/http';
import { AppError } from '@/lib/validation';

export async function GET(_request: Request, context: RouteContext<'/api/orders/[id]/qr'>) {
  return api(async () => {
    const order = await receipt((await context.params).id);
    if (order.status !== 'paid' || !order.token) throw new AppError('La entrada todavía no fue emitida.', 409);
    const png = await QRCode.toBuffer(order.token, { width: 640, margin: 4, errorCorrectionLevel: 'M' });
    return new Response(new Uint8Array(png), { headers: {
      'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="samiticket-${order.id}.png"`,
      'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    } });
  });
}
