import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('deduplicates, caches, and spaces upstream geocoding calls by at least one second', async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.stubEnv('NOMINATIM_CONTACT', 'demo@example.com');
  const calls: number[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    calls.push(Date.now());
    return Response.json([{ place_id: 1, display_name: 'Huancayo', lat: '-12.06', lon: '-75.2', type: 'city' }]);
  });
  const { searchLocations } = await import('@/lib/server/geocoding');
  const first = searchLocations('Huancayo'); const duplicate = searchLocations('Huancayo'); const second = searchLocations('Lima');
  await vi.runAllTimersAsync();
  expect(await first).toEqual(await duplicate); await second;
  expect(calls).toHaveLength(2); expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(1000);
  await searchLocations('Huancayo'); expect(calls).toHaveLength(2);
});
it('works without contact and requests Spanish Peru address details from the configurable endpoint', async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.stubEnv('NOMINATIM_CONTACT', ''); vi.stubEnv('NOMINATIM_SEARCH_URL', 'https://geo.example/search');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([{ place_id: 1, display_name: 'Plaza, Cusco', lat: '-13.53', lon: '-71.97', type: 'square', address: { city: 'Cusco' } }]));
  const { searchLocations } = await import('@/lib/server/geocoding');
  const result = searchLocations('Cusco'); await vi.runAllTimersAsync();
  expect((await result)[0].city).toBe('Cusco');
  const [url, options] = fetcher.mock.calls[0]; const params = new URL(String(url)).searchParams;
  expect(params.get('countrycodes')).toBe('pe'); expect(params.get('addressdetails')).toBe('1'); expect(params.get('accept-language')).toBe('es');
  expect(String(url)).toContain('geo.example'); expect(options?.headers).toEqual(expect.objectContaining({ 'User-Agent': 'SamiTicket-Demo/1.0' }));
});
