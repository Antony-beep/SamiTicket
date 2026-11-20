import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatUsdEstimate, getPenToUsdRate } from '@/lib/server/currency';
import { googleCalendarUrl } from '@/lib/events';
import { buildEventIcs } from '@/app/api/events/[id]/calendar/route';
import { buildOrdersCsv } from '@/app/api/events/[id]/export/route';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Currency rate, ICS calendar and CSV export APIs', () => {
  it('fetches PEN to USD exchange rate and formats USD estimate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ result: 'success', rates: { USD: 0.27 } })
    );
    const rate = await getPenToUsdRate(true);
    expect(rate).toBe(0.27);
    expect(formatUsdEstimate(3000, rate)).toBe('≈ USD 8.10');
    expect(formatUsdEstimate(0, rate)).toBeNull();
  });

  it('builds a valid RFC 5545 ICS calendar file with GPS coordinates', () => {
    const ics = buildEventIcs({
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Gran Concurso de Huaylarsh Wanka',
      description: 'Fiesta en Huancayo',
      starts_at: '2026-11-27T19:00:00.000Z',
      venue: 'Coliseo Wanka',
      address: 'Av. Huancavelica s/n',
      city: 'Huancayo',
      latitude: -12.06513,
      longitude: -75.20486,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Gran Concurso de Huaylarsh Wanka');
    expect(ics).toContain('GEO:-12.06513;-75.20486');
    expect(ics).toContain('END:VCALENDAR');

    const gcal = googleCalendarUrl({
      title: 'Gran Concurso de Huaylarsh Wanka',
      startsAt: '2026-11-27T19:00:00.000Z',
      venue: 'Coliseo Wanka',
      address: 'Av. Huancavelica s/n',
      city: 'Huancayo',
    });
    expect(gcal).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(gcal).toContain('ctz=America%2FLima');
    expect(gcal).toContain('dates=20261127T190000Z%2F20261127T220000Z');
  });

  it('builds UTF-8 BOM CSV with verified RENIEC DNI and formula-injection guard', () => {
    const csv = buildOrdersCsv([
      {
        id: 'order-1',
        buyer_name: '=JUAN CARLOS QUISPE',
        buyer_dni: '47291038',
        buyer_email: 'juan@example.com',
        amount_cents: 2500,
        status: 'paid',
        created_at: '2026-11-20T15:00:00Z',
      },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Orden ID,Comprador,DNI RENIEC,Correo,Importe (PEN),Estado,Fecha (UTC)');
    expect(csv).toContain('"\'=JUAN CARLOS QUISPE","47291038","juan@example.com","25.00","Aprobado"');
  });
});
