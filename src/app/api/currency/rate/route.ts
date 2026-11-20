import { getPenToUsdRate } from '@/lib/server/currency';
import { api } from '@/lib/server/http';

export async function GET() {
  return api(async () => {
    const rate = await getPenToUsdRate(true);
    return Response.json(
      { base: 'PEN', target: 'USD', rate, available: rate !== null },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  });
}
