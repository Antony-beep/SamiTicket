import { describe, expect, it } from 'vitest';
import { buyerInput, email, eventInput, priceCents, qrToken, safeNext, uuid } from '@/lib/validation';

describe('request validation', () => {
  it('accepts only internal login destinations', () => {
    for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil', '/auth/callback', '/login', null, ['//evil.test']]) expect(safeNext(value)).toBe('/panel');
    expect(safeNext('/panel/123/editar?tab=puerta')).toBe('/panel/123/editar?tab=puerta');
  });
  it('parses decimal prices without floating point rounding or permissive number syntax', () => {
    for (const value of ['0.29', '0,29']) expect(priceCents(value)).toBe(29);
    expect(priceCents('1000000,00')).toBe(100000000);
    for (const value of ['', ' ', '-1', '1e3', 'Infinity', '12.345', '1,000.00', '1000000.01', '.5']) expect(() => priceCents(value)).toThrow();
  });
  it('normalizes Unicode names and requires matching coordinate pairs', () => {
    expect(buyerInput({ name: '  José   山田  ', email: 'USER@EXAMPLE.COM' })).toEqual({ name: 'José 山田', email: 'user@example.com' });
    expect(() => eventInput({ priceCents: 0, capacity: 1, latitude: -12 })).toThrow();
    expect(() => eventInput({ priceCents: 0, capacity: 1, longitude: NaN })).toThrow();
    expect(() => eventInput({ priceCents: 0, capacity: 1, date: '2026-10-20' })).toThrow();
    expect(qrToken('A'.repeat(64))).toBe('a'.repeat(64));
    expect(() => qrToken('g'.repeat(64))).toThrow();
  });
  it('normalizes emails and rejects malformed identifiers', () => {
    expect(email(' Person@Example.COM ')).toBe('person@example.com');
    expect(() => email('a@b')).toThrow();
    expect(() => uuid('not-a-uuid')).toThrow();
  });
  it('stores integer cents and Lima local time', () => {
    const data = eventInput({ date: '2026-12-31', startTime: '20:00', priceCents: 2599, capacity: 50 });
    expect(data.starts_at).toBe('2027-01-01T01:00:00.000Z');
    expect(data.price_cents).toBe(2599);
    expect(data.latitude).toBeNull();
    for (const invalid of [{ priceCents: 1.5 }, { capacity: -1 }, { latitude: 91 }, { date: '2026-02-30', startTime: '20:00' }, { date: '2026-12-01', startTime: '24:00' }]) {
      expect(() => eventInput({ priceCents: 2500, capacity: 10, ...invalid })).toThrow();
    }
  });
});
