import 'server-only';

let cachedRate: { value: number; expiresAt: number } | null = null;

export async function getPenToUsdRate(forceInTest = false): Promise<number | null> {
  if (process.env.VITEST && !forceInTest) return null;
  if (cachedRate && cachedRate.expiresAt > Date.now()) {
    return cachedRate.value;
  }
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/PEN', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const data = await response.json() as { rates?: { USD?: number } };
    const usd = data.rates?.USD;
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0.05 || usd >= 2) {
      return null;
    }
    cachedRate = { value: usd, expiresAt: Date.now() + 3600_000 };
    return usd;
  } catch {
    return null;
  }
}

export function formatUsdEstimate(priceCents: number, rate: number | null): string | null {
  if (!rate || !Number.isFinite(priceCents) || priceCents <= 0) return null;
  const usd = (priceCents / 100) * rate;
  return `≈ USD ${usd.toFixed(2)}`;
}
