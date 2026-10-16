'use client';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { buyerInput } from '@/lib/validation';
import { FieldError, fieldErrors, focusError } from './field-errors';
import { useEffect } from 'react';

export function BuyerRegistration({ eventId, available, demoEnabled }: { eventId: string; available: number; demoEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { focusError(form.current, errors); }, [errors]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setErrors({}); setMessage('Verificando correo y preparando tu compra…');
    try {
      const normalized = buyerInput({ name, email });
      await clientApi('/api/orders/session', 'POST');
      const key = `samiticket:checkout:${eventId}`;
      const previous = sessionStorage.getItem(key);
      const fingerprint = JSON.stringify(normalized);
      let saved: { id: string; fingerprint: string } | null = null;
      try { saved = previous ? JSON.parse(previous) : null; } catch { /* A damaged draft can be replaced safely. */ }
      const id = saved?.fingerprint === fingerprint ? saved.id : crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ id, fingerprint }));
      const order = await clientApi<{ url: string }>('/api/orders', 'POST', { id, eventId, ...normalized });
      router.push(order.url);
    } catch (error) { setErrors(fieldErrors(error)); setMessage((error as Error).message || 'No pudimos conectar. Reintenta.'); }
    finally { setBusy(false); lock.current = false; }
  }
  return <form ref={form} noValidate className="checkout-card" onSubmit={submit}>
    <h2>Compra una entrada general</h2><p>Sin cuenta. Recibirás tu QR aquí y podrás descargarlo.</p>
    <p className="notice">Demostración: el pago es simulado. No se realiza ningún cobro.</p>
    <fieldset disabled={busy || !demoEnabled || available <= 0}>
      <div className="field-group"><label htmlFor="buyer-name">Nombre completo</label><input id="buyer-name" data-field="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} /><FieldError name="name" errors={errors} /></div>
      <div className="field-group"><label htmlFor="buyer-email">Correo</label><input id="buyer-email" data-field="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} autoComplete="email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><FieldError name="email" errors={errors} /></div>
      <button className="button button-primary" type="submit">{busy ? 'Verificando…' : 'Continuar al pago simulado'}</button>
    </fieldset>
    {!demoEnabled && <p role="status">Los pagos simulados están deshabilitados.</p>}
    {available <= 0 && <p role="status">Entradas agotadas.</p>}
    {message && <p className="field-help" role="status">{message}</p>}
    <p className="privacy-note">Disify verifica que el correo sea válido y no temporal. No enviamos correos en esta demo.</p>
  </form>;
}
