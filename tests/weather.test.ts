import { afterEach, expect, it, vi } from 'vitest';
import { forecastOffset, parseForecast, peruToday, weatherAdvice, type OpenMeteoData } from '@/lib/weather';
import { getEventWeather } from '@/lib/server/weather';

const now = new Date('2026-10-17T02:00:00Z'); // Still October 16 in Peru.
function fixture(): OpenMeteoData {
  const days = Array.from({ length: 15 }, (_, i) => `2026-10-${String(16 + i).padStart(2, '0')}`);
  return { daily: { time: days, weather_code: days.map(() => 0), temperature_2m_max: days.map(() => 29), temperature_2m_min: days.map(() => 8), precipitation_probability_max: days.map(() => 10) },
    hourly: { time: days.flatMap(day => Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`)), weather_code: Array(360).fill(0), temperature_2m: Array(360).fill(10), precipitation_probability: Array(360).fill(10), is_day: Array.from({ length: 360 }, (_, i) => i % 24 >= 6 && i % 24 <= 18 ? 1 : 0) } };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('covers exactly today through +14 using Peru calendar time', () => {
  expect(peruToday(now)).toBe('2026-10-16'); expect(forecastOffset('2026-10-30', now)).toBe(14);
  const data = fixture();
  expect(parseForecast(data, undefined, undefined, now).days).toHaveLength(15);
  expect(parseForecast(data, '2026-10-16', undefined, now).status).toBe('ready');
  expect(parseForecast(data, '2026-10-30', '23:59', now).forecast?.hour?.time).toBe('23:00');
  expect(parseForecast(data, '2026-10-30', undefined, now).forecast?.distant).toBe(true);
  expect(parseForecast(data, '2026-10-31', undefined, now).status).toBe('out_of_range');
});
it('does not turn null or incomplete daily/hourly data into a sunny recommendation', () => {
  const data = fixture(); data.daily!.weather_code![0] = null;
  expect(parseForecast(data, '2026-10-16', undefined, now).status).toBe('unavailable');
  const second = fixture(); second.hourly!.temperature_2m![20] = null;
  expect(parseForecast(second, '2026-10-16', '20:00', now).forecast).toBeNull();
  expect(parseForecast({}, '2026-10-16', undefined, now).status).toBe('unavailable');
});
it('prioritizes adverse weather and adapts advice to outdoors, temperatures and night', () => {
  const data = fixture();
  let forecast = parseForecast(data, '2026-10-16', '20:00', now).forecast!;
  expect(forecast.hour!.isDay).toBe(false);
  expect(weatherAdvice(forecast, true).join(' ')).not.toContain('sombra');
  expect(weatherAdvice(forecast, true).join(' ')).toContain('abrigo');
  for (const code of [56, 66, 77, 85, 96, 99]) {
    data.daily!.weather_code![0] = code;
    forecast = parseForecast(data, '2026-10-16', undefined, now).forecast!;
    expect(weatherAdvice(forecast, true)[0]).toContain('contingencia');
    expect(weatherAdvice(forecast, false)[0]).toContain('acceso');
  }
  data.daily!.weather_code![0] = 3; data.daily!.precipitation_probability_max![0] = 0;
  forecast = parseForecast(data, '2026-10-16', undefined, now).forecast!;
  expect(weatherAdvice(forecast, true)[0]).toContain('no implica lluvia');
  expect(weatherAdvice(forecast, false).join(' ')).toContain('ventilación');
  data.daily!.precipitation_probability_max![0] = 60;
  expect(weatherAdvice(parseForecast(data, '2026-10-16', undefined, now).forecast!, true)[0]).toContain('contingencia');
  data.daily!.weather_code![0] = 0; data.daily!.precipitation_probability_max![0] = 0;
  expect(weatherAdvice(parseForecast(data, '2026-10-16', '12:00', now).forecast!, true)[0]).toContain('sombra');
});
it.each([
  ['Lima', -12.0464, -77.0428], ['Huancayo', -12.0651, -75.2049], ['Cusco', -13.5319, -71.9675], ['Arequipa', -16.409, -71.5375], ['Piura', -5.1945, -80.6328], ['Iquitos', -3.7437, -73.2516], ['Puno', -15.8402, -70.0219],
])('requests the exact coordinates of %s with 15 days and hourly data', async (_, lat, lng) => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(fixture()));
  expect((await getEventWeather(Number(lat), Number(lng), '2026-10-30', '20:00')).status).toBe('ready');
  const [url, options] = fetcher.mock.calls[0]; const params = new URL(String(url)).searchParams;
  expect(params.get('latitude')).toBe(String(lat)); expect(params.get('longitude')).toBe(String(lng));
  expect(params.get('forecast_days')).toBe('15'); expect(params.get('timezone')).toBe('America/Lima'); expect(params.get('hourly')).toContain('is_day');
  expect(options).toEqual(expect.objectContaining({ next: { revalidate: 3600 }, signal: expect.any(AbortSignal) }));
});
it('degrades on upstream failures and avoids requesting dates outside the range', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  expect((await getEventWeather(-12, -75, '2026-10-16')).status).toBe('unavailable');
  fetcher.mockClear();
  expect((await getEventWeather(-12, -75, '2026-10-31')).status).toBe('out_of_range'); expect(fetcher).not.toHaveBeenCalled();
});
