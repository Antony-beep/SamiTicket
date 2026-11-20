'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { buyerInput } from '@/lib/validation';
import { FieldError, fieldErrors, focusError } from './field-errors';
import { useEffect } from 'react';
import { HaloProgress } from './ui/halo-progress';
import { ReniecVerification, type VerifiedReniecIdentity } from './reniec-verification';

export function BuyerRegistration({ eventId, available, demoEnabled, mercadoPagoEnabled = false, reniecRequired = false }: {
  eventId: string; available: number; demoEnabled: boolean; mercadoPagoEnabled?: boolean; reniecRequired?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reniec, setReniec] = useState<VerifiedReniecIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { focusError(form.current, errors); }, [errors]);
  function handleReniec(identity: VerifiedReniecIdentity | null) {
    setReniec(identity);
    if (identity) {
      setName(identity.name);
      setErrors(prev => {
        const next = { ...prev };
        delete next.reniec;
        delete next.name;
        return next;
      });
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (reniecRequired && !reniec) {
      setErrors({ reniec: 'Verifica tu identidad con Perú Pass (DNId) antes de comprar.' });
      return;
    }
    lock.current = true; setBusy(true); setErrors({}); setMessage('Verificando correo y preparando tu compra…');
    try {
      const normalized = buyerInput({ name: reniec?.name ?? name, email });
      await clientApi('/api/orders/session', 'POST');
      const key = `samiticket:checkout:${eventId}`;
      const previous = sessionStorage.getItem(key);
      const fingerprint = JSON.stringify(normalized);
      let saved: { id: string; fingerprint: string } | null = null;
      try { saved = previous ? JSON.parse(previous) : null; } catch { /* A damaged draft can be replaced safely. */ }
      const id = saved?.fingerprint === fingerprint ? saved.id : crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ id, fingerprint }));
      const order = await clientApi<{ id: string; url: string }>('/api/orders', 'POST', {
        id,
        eventId,
        ...normalized,
        ...(reniec ? { reniecToken: reniec.verificationToken } : {}),
      });
      if (order.id !== id) sessionStorage.setItem(key, JSON.stringify({ id: order.id, fingerprint }));
      router.push(order.url);
    } catch (error) { setErrors(fieldErrors(error)); setMessage((error as Error).message || 'No pudimos conectar. Reintenta.'); }
    finally { setBusy(false); lock.current = false; }
  }
  return <form ref={form} noValidate className="checkout-card" onSubmit={submit}>
    <h2>Compra una entrada general</h2><p>Sin cuenta. Recibirás tu QR aquí y podrás descargarlo.</p>
    <p className="notice">{mercadoPagoEnabled ? 'Mercado Pago · Prueba. Usa el comprador y las tarjetas ficticias de la demo. El vendedor es una cuenta de prueba de SamiTicket.' : 'Demostración: el pago es simulado. No se realiza ningún cobro.'}</p>
    <fieldset disabled={busy || (!demoEnabled && !mercadoPagoEnabled) || available <= 0}>
      {reniecRequired && (
        <ReniecVerification
          required
          demoEnabled={demoEnabled}
          disabled={busy}
          verified={reniec}
          error={errors.reniec}
          onVerified={handleReniec}
        />
      )}
      <div className="field-group"><label htmlFor="buyer-name">Nombre completo</label><Input id="buyer-name" data-field="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} autoComplete="name" required minLength={2} maxLength={120} readOnly={Boolean(reniec)} placeholder={reniecRequired && !reniec ? 'Se autocompletará al verificar tu DNI arriba' : undefined} value={name} onChange={e => setName(e.target.value)} /><FieldError name="name" errors={errors} /></div>
      <div className="field-group"><label htmlFor="buyer-email">Correo</label><Input id="buyer-email" data-field="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} autoComplete="email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><FieldError name="email" errors={errors} /></div>
      <Button className="button button-primary" type="submit">{busy ? 'Verificando…' : mercadoPagoEnabled ? 'Continuar al pago' : 'Continuar al pago simulado'}</Button>
    </fieldset>
    {!demoEnabled && !mercadoPagoEnabled && <p role="status">Los pagos simulados están deshabilitados.</p>}
    {available <= 0 && <p role="status">Entradas agotadas.</p>}
    {busy ? <HaloProgress value={null} label={message} /> : message && <p className="field-help" role="status">{message}</p>}
    <p className="privacy-note">Disify verifica que el correo sea válido y no temporal. No enviamos correos en esta demo.</p>
  </form>;
}
