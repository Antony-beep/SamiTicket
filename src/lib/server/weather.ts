import 'server-only';
import { forecastOffset, parseForecast, type OpenMeteoData, type WeatherResult } from '@/lib/weather';

export async function getEventWeather(latitude: number, longitude: number, date?: string, time?: string): Promise<WeatherResult> {
  if (date && (forecastOffset(date) < 0 || forecastOffset(date) > 14)) return { status: 'out_of_range', days: [], forecast: null };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: 'America/Lima', forecast_days: '15',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', hourly: 'weather_code,temperature_2m,precipitation_probability,is_day' }).toString();
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('unavailable');
    return parseForecast(await response.json() as OpenMeteoData, date, time);
  } catch { return { status: 'unavailable', days: [], forecast: null }; }
}
