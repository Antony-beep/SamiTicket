import { reconcilePayment, verifyNotification } from '@/lib/server/mercadopago';
import { api } from '@/lib/server/http';

export async function POST(request: Request) {
  return api(async () => {
    const paymentId = verifyNotification(request);
    // Acknowledge only after the transaction commits so a failed delivery remains retryable.
    await reconcilePayment(paymentId);
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
