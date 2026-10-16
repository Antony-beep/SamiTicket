'use client';
import { useEffect, useState } from 'react';
import { validDate, weatherAdvice, type WeatherResult } from '@/lib/weather';

export function WeatherPanel({ latitude, longitude, date, time, outdoor }: { latitude: number | null; longitude: number | null; date: string; time: string; outdoor: boolean }) {
  const [state, setState] = useState<{ key: string; data: WeatherResult | null }>({ key: '', data: null });
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([latitude, longitude, date, time, retry]);
  const valid = latitude !== null && longitude !== null && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && validDate(date) && (!time || /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), date, ...(time ? { time } : {}) });
      void fetch(`/api/weather/forecast?${params}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { if (!controller.signal.aborted) setState({ key, data }); })
        .catch(() => { if (!controller.signal.aborted) setState({ key, data: { status: 'unavailable', days: [], forecast: null } }); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [valid, latitude, longitude, date, time, key]);
  if (!valid) return <p className="field-help">Elige lugar y fecha para consultar el clima en ese punto del Perú.</p>;
  const data = state.key === key ? state.data : null;
  const forecast = data?.forecast;
  return <section className="forecast-panel" aria-label="Clima del evento" aria-live="polite">
    <h3>Clima para el {date}</h3>
    {!data && <p>Consultando clima…</p>}
    {data?.status === 'out_of_range' && <p>El pronóstico cubre hoy y los siguientes 14 días. Todavía no hay pronóstico para esta fecha.</p>}
    {data?.status === 'unavailable' && <><p>Clima no disponible. Puedes continuar.</p><button type="button" className="button button-secondary" onClick={() => setRetry(v => v + 1)}>Reintentar clima</button></>}
    {forecast && <><p><strong>{forecast.condition}</strong> · Mín. {Math.round(forecast.min)} °C / Máx. {Math.round(forecast.max)} °C · Precipitación {forecast.precipitationProbability}%</p>
      {forecast.hour && <p>Inicio aproximado: {forecast.hour.time} (hora peruana, {forecast.hour.isDay ? 'día' : 'noche'}) · {forecast.hour.condition} · {Math.round(forecast.hour.temperature)} °C · Precipitación {forecast.hour.precipitationProbability}%</p>}
      <ul>{weatherAdvice(forecast, outdoor).map(advice => <li key={advice}>{advice}</li>)}</ul>
      <p className="field-help">Pronóstico orientativo; puede cambiar.{forecast.distant ? ' A 7–14 días, revisa nuevamente cerca del evento.' : ''} <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p></>}
  </section>;
}
