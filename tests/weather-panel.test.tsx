// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { WeatherPanel } from '@/components/weather-panel';
beforeEach(() => { vi.stubGlobal('React', React); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('discards stale advice when manual coordinates change and handles cancellation/outage', async () => {
  let firstSignal: AbortSignal | undefined;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    firstSignal ??= options?.signal as AbortSignal;
    return Response.json({ status: 'ready', days: [], forecast: { date: '2026-10-16', code: 95, condition: 'Tormenta', max: 20, min: 8, precipitationProbability: 90, hour: null, distant: false } });
  });
  const view = render(<WeatherPanel latitude={-12} longitude={-75} date="2026-10-16" time="" outdoor />);
  await screen.findByText('Tormenta'); expect(screen.getByText(/contingencia/)).toBeDefined();
  fetcher.mockRejectedValue(new Error('offline'));
  view.rerender(<WeatherPanel latitude={-3.74} longitude={-73.25} date="2026-10-16" time="20:00" outdoor />);
  expect(screen.queryByText('Tormenta')).toBeNull(); expect(firstSignal?.aborted).toBe(true);
  await screen.findByText('Clima no disponible. Puedes continuar.');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(String(fetcher.mock.calls[1][0])).toContain('latitude=-3.74');
});
