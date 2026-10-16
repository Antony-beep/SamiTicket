'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationSearch, type SelectedLocation } from './location-search';
import { LocationMap } from './location-map';
import { WeatherPanel } from './weather-panel';
import { CoverInput } from './cover-input';
import { FieldError, fieldErrors, focusError } from './field-errors';
import { clientApi } from '@/lib/client-api';
import { AppError, eventInput, publicationErrors } from '@/lib/validation';
import type { Event as TicketEvent } from '@/lib/events';

export function EventForm({ initial }: { initial?: TicketEvent }) {
  const router = useRouter(), form = useRef<HTMLFormElement>(null);
  const eventId = useRef(initial?.id ?? ''), persisted = useRef(Boolean(initial)), lock = useRef(false);
  const focusPending = useRef(false);
  const [values, setValues] = useState({
    title: initial?.title ?? '', description: initial?.description ?? '', date: initial?.date ?? '', startTime: initial?.startTime ?? '',
    venue: initial?.venue ?? '', address: initial?.address ?? '', city: initial?.city ?? '', reference: initial?.reference ?? '',
    latitude: initial?.latitude?.toString() ?? '', longitude: initial?.longitude?.toString() ?? '',
    category: initial?.category ?? 'Música y cultura', outdoor: initial?.outdoor ?? false,
    price: initial ? (initial.priceCents / 100).toFixed(2) : '25.00', capacity: initial?.capacity.toString() ?? '100',
  });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}), [file, setFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState(initial?.coverSmallUrl ?? null);
  const [holiday, setHoliday] = useState<string | null>(null), [moved, setMoved] = useState(false);
  const latitude = values.latitude.trim() ? Number(values.latitude) : null, longitude = values.longitude.trim() ? Number(values.longitude) : null;
  function clearErrors(keys: string[]) {
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !keys.includes(key))));
    setMessage('');
  }
  function change(key: keyof typeof values, value: string | boolean) {
    setValues(previous => ({ ...previous, [key]: value }));
    clearErrors(key === 'date' || key === 'startTime' ? ['date', 'startTime'] : key === 'latitude' || key === 'longitude' ? ['latitude', 'longitude'] : [key]);
  }
  useEffect(() => { if (focusPending.current) { focusPending.current = false; focusError(form.current, errors); } }, [errors]);
  useEffect(() => {
    if (!values.date) return;
    const controller = new AbortController();
    void fetch(`/api/calendar/holiday?date=${values.date}`, { signal: controller.signal })
      .then(r => r.json()).then(data => { if (!controller.signal.aborted) setHoliday(data.holiday?.name ?? null); })
      .catch(() => { if (!controller.signal.aborted) setHoliday(null); });
    return () => controller.abort();
  }, [values.date]);
  function select(place: SelectedLocation) {
    clearErrors(['venue', 'address', 'city', 'latitude', 'longitude']);
    setValues(previous => ({ ...previous, venue: place.label.split(',')[0].slice(0, 200), address: (place.address || place.label).slice(0, 300), city: place.city || previous.city,
      latitude: String(place.latitude), longitude: String(place.longitude) }));
    setMoved(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setErrors({});
    const publish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish';
    try {
      const parsed = eventInput({ ...values, latitude, longitude, capacity: values.capacity.trim() ? Number(values.capacity) : null });
      if (publish) {
        const errors = publicationErrors({ ...values, latitude, longitude }, Boolean(file || coverUrl));
        if (Object.keys(errors).length) throw new AppError('Completa los campos para publicar.', 400, errors);
      }
      if (file && file.size > 8 * 1024 * 1024) throw new AppError('La imagen debe pesar hasta 8 MiB.', 413, { cover: 'La imagen debe pesar hasta 8 MiB.' });
      if (!eventId.current) eventId.current = crypto.randomUUID();
      const data = { ...values, id: eventId.current, latitude, longitude, priceCents: parsed.price_cents, capacity: parsed.capacity };
      setMessage('Guardando borrador…');
      await clientApi(persisted.current ? `/api/events/${eventId.current}` : '/api/events', persisted.current ? 'PATCH' : 'POST', data);
      persisted.current = true;
      if (file) {
        setMessage('Procesando y guardando las dos portadas WebP…');
        const upload = new FormData(); upload.set('cover', file);
        const result = await clientApi<{ version: string }>(`/api/events/${eventId.current}/cover`, 'PUT', upload);
        setCoverUrl(`/api/events/${eventId.current}/cover?size=small&v=${result.version}`); setFile(null);
      }
      if (publish) { setMessage('Publicando evento…'); await clientApi(`/api/events/${eventId.current}/publish`, 'POST'); }
      router.push(`/panel/${eventId.current}`); router.refresh();
    } catch (error) { focusPending.current = true; setErrors(fieldErrors(error)); setMessage((error as Error).message); }
    finally { setBusy(false); lock.current = false; }
  }
  const attrs = (key: string) => ({ 'data-field': key, 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined });
  const field = (key: keyof typeof values, label: string, type = 'text', maxLength = 200) => <div className="field-group">
    <label htmlFor={key}>{label}</label><input {...attrs(key)} id={key} type={type} maxLength={maxLength} value={String(values[key])} onChange={e => { change(key, e.target.value); if (key === 'date') setHoliday(null); }} /><FieldError name={key} errors={errors} />
  </div>;
  return <form ref={form} className="event-form" noValidate onSubmit={submit}>
    <fieldset disabled={busy}>
      <section className="form-section"><h2>Lo esencial</h2>
        {field('title', 'Nombre del evento', 'text', 160)}
        <div className="field-group"><label htmlFor="description">Descripción</label><textarea {...attrs('description')} id="description" rows={4} maxLength={5000} value={values.description} onChange={e => change('description', e.target.value)} /><FieldError name="description" errors={errors} /></div>
        <CoverInput file={file} currentUrl={coverUrl} onChange={file => { setFile(file); clearErrors(['cover']); }} errors={errors} />
        <div className="two-columns">{field('date', 'Fecha', 'date')}{field('startTime', 'Hora de inicio', 'time')}</div>
        {holiday && <p className="selection-note">Feriado: {holiday}</p>}
        {field('category', 'Categoría', 'text', 80)}
      </section>
      <section className="form-section"><h2>Ubicación</h2>
        <LocationSearch onSelect={select} />
        <p className="field-help">También puedes ingresar local, dirección y coordenadas manualmente.</p>
        {field('venue', 'Nombre del local')}{field('address', 'Dirección', 'text', 300)}{field('city', 'Ciudad', 'text', 100)}{field('reference', 'Referencia de ingreso (opcional)', 'text', 300)}
        <LocationMap latitude={latitude} longitude={longitude} onChange={(lat, lng) => { if (busy) return; clearErrors(['latitude', 'longitude']); setValues(v => ({ ...v, latitude: lat.toFixed(6), longitude: lng.toFixed(6) })); setMoved(true); }} />
        {moved && <p className="selection-note">Moviste el punto. Revisa la dirección escrita; no la cambiamos automáticamente.</p>}
        <div className="two-columns">{field('latitude', 'Latitud (ej. -12.06513)')}{field('longitude', 'Longitud (ej. -75.20486)')}</div>
        <label className="checkbox-row"><input type="checkbox" checked={values.outdoor} onChange={e => change('outdoor', e.target.checked)} />Evento al aire libre</label>
        <WeatherPanel latitude={latitude} longitude={longitude} date={values.date} time={values.startTime} outdoor={values.outdoor} />
      </section>
      <section className="form-section"><h2>Entrada general</h2><div className="two-columns">
        <div className="field-group"><label htmlFor="price">Precio en soles</label><input {...attrs('price')} id="price" inputMode="decimal" maxLength={12} value={values.price} onChange={e => change('price', e.target.value)} /><FieldError name="price" errors={errors} /></div>
        <div className="field-group"><label htmlFor="capacity">Cantidad</label><input {...attrs('capacity')} id="capacity" type="number" min="1" max="10000" step="1" value={values.capacity} onChange={e => change('capacity', e.target.value)} /><FieldError name="capacity" errors={errors} /></div>
      </div></section>
      <p className="field-help">Puedes guardar un borrador incompleto. Publicar exige todos los datos y portada. Después solo podrás reemplazar la portada.</p>
      <div className="actions"><button className="button button-secondary" type="submit" value="draft">Guardar borrador</button><button className="button button-primary" type="submit" value="publish">{busy ? 'Guardando…' : 'Publicar evento'}</button></div>
    </fieldset>
    {message && <p className={`notice${Object.keys(errors).length ? ' notice-error' : ''}`} role="status">{message}</p>}
  </form>;
}
