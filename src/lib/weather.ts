export type ForecastDay = { date: string; condition: string; code: number; max: number; min: number; precipitationProbability: number };
export type WeatherForecast = ForecastDay & { hour: { time: string; temperature: number; code: number; condition: string; precipitationProbability: number; isDay: boolean } | null; distant: boolean };
export type WeatherResult = { status: 'ready' | 'unavailable' | 'out_of_range'; days: ForecastDay[]; forecast: WeatherForecast | null };
export type OpenMeteoData = {
  daily?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; precipitation_probability_max?: (number | null)[] };
  hourly?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m?: (number | null)[]; precipitation_probability?: (number | null)[]; is_day?: (number | null)[] };
};
const labels: Record<number, string> = { 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina con escarcha', 51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa', 56: 'Llovizna helada ligera', 57: 'Llovizna helada intensa', 61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa', 66: 'Lluvia helada ligera', 67: 'Lluvia helada intensa', 71: 'Nevada ligera', 73: 'Nevada moderada', 75: 'Nevada intensa', 77: 'Granizo de nieve', 80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos intensos', 85: 'Chubascos de nieve ligeros', 86: 'Chubascos de nieve intensos', 95: 'Tormenta', 96: 'Tormenta con granizo', 97: 'Tormenta intensa', 99: 'Tormenta con granizo intenso' };
export const weatherLabel = (code: number) => labels[code] ?? 'Condiciones variables';
export const peruToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date; }
export function forecastOffset(date: string, now = new Date()) { return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${peruToday(now)}T00:00:00Z`)) / 86400000); }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function parseForecast(data: OpenMeteoData, date?: string, time?: string, now = new Date()): WeatherResult {
  if (date && (forecastOffset(date, now) < 0 || forecastOffset(date, now) > 14)) return { status: 'out_of_range', days: [], forecast: null };
  const daily = data.daily;
  const days: ForecastDay[] = [];
  for (const [i, day] of (daily?.time ?? []).entries()) {
    const code = daily?.weather_code?.[i], max = daily?.temperature_2m_max?.[i], min = daily?.temperature_2m_min?.[i], rain = daily?.precipitation_probability_max?.[i];
    if (!validDate(day) || forecastOffset(day, now) < 0 || forecastOffset(day, now) > 14 || !finite(code) || !finite(max) || !finite(min) || !finite(rain) || rain < 0 || rain > 100) continue;
    days.push({ date: day, code, condition: weatherLabel(code), max, min, precipitationProbability: rain });
  }
  const selected = days.find(day => day.date === date);
  if (date && !selected || !days.length) return { status: 'unavailable', days, forecast: null };
  if (!selected) return { status: 'ready', days, forecast: null };
  let hour: WeatherForecast['hour'] = null;
  if (time) {
    // Nearest hour within the selected day; never borrow tomorrow's forecast at 23:59.
    const target = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const hours = (data.hourly?.time ?? []).map((stamp, i) => ({ stamp, i })).filter(row => row.stamp.startsWith(`${date}T`));
    hours.sort((a, b) => Math.abs(Number(a.stamp.slice(11, 13)) * 60 - target) - Math.abs(Number(b.stamp.slice(11, 13)) * 60 - target));
    const nearest = hours[0];
    if (nearest) {
      const i = nearest.i, temp = data.hourly?.temperature_2m?.[i], code = data.hourly?.weather_code?.[i], rain = data.hourly?.precipitation_probability?.[i], isDay = data.hourly?.is_day?.[i];
      if (finite(temp) && finite(code) && finite(rain) && rain >= 0 && rain <= 100 && (isDay === 0 || isDay === 1)) hour = { time: nearest.stamp.slice(11, 16), temperature: temp, code, condition: weatherLabel(code), precipitationProbability: rain, isDay: isDay === 1 };
    }
    if (!hour) return { status: 'unavailable', days, forecast: null };
  }
  return { status: 'ready', days, forecast: { ...selected, hour, distant: forecastOffset(selected.date, now) >= 7 } };
}
export function weatherAdvice(forecast: WeatherForecast, outdoor: boolean) {
  const hour = forecast.hour;
  const adverse = (code: number) => code >= 51;
  const wet = adverse(forecast.code) || forecast.precipitationProbability >= 60 || !!hour && (adverse(hour.code) || hour.precipitationProbability >= 60);
  const advice: string[] = [];
  if (wet) advice.push(outdoor ? 'Prevé techo o un plan de contingencia por precipitación.' : 'Revisa que el acceso al local esté protegido de la precipitación.');
  else if (outdoor && hour?.isDay && hour.code <= 1) advice.push('Considera sombra para asistentes durante el día.');
  else if ((hour?.code ?? forecast.code) === 2 || (hour?.code ?? forecast.code) === 3) advice.push('Se espera nubosidad; esto no implica lluvia.');
  else if (!hour && outdoor && forecast.code <= 1) advice.push('Si habrá actividades de día, considera sombra.');
  if ((hour?.temperature ?? forecast.min) < 12) advice.push('Sugiere llevar abrigo.');
  if ((hour?.temperature ?? forecast.max) >= 28) advice.push('Prepara agua y buena ventilación.');
  return advice;
}
