'use client';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { email as validateEmail } from '@/lib/validation';

export function EventActions({ eventId, status, staff }: { eventId: string; status: string; staff: { email: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const [emailError, setEmailError] = useState('');
  async function act(path: string, method = 'POST', data?: unknown) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try { await clientApi(`/api/events/${eventId}/${path}`, method, data); setEmail(''); setMessage('Cambios guardados.'); router.refresh(); }
    catch (error) { setMessage((error as Error).message); if (path === 'staff' && method === 'POST') { setEmailError((error as Error).message); document.getElementById('staff-email')?.focus(); } }
    finally { locked.current = false; setBusy(false); }
  }
  function add(event: FormEvent) {
    event.preventDefault();
    try { const address = validateEmail(email); setEmailError(''); void act('staff', 'POST', { email: address }); }
    catch (error) { setEmailError((error as Error).message); document.getElementById('staff-email')?.focus(); }
  }
  return <section className="panel-card">
    {status === 'draft' && <div className="notice"><p>Al publicar, los datos quedan bloqueados.</p><button className="button button-primary" disabled={busy} onClick={() => act('publish')}>Publicar evento</button></div>}
    <h2>Personal de puerta</h2><p>La persona debe iniciar sesión y verificar su correo primero. Solo podrá controlar el ingreso a este evento.</p>
    <form noValidate onSubmit={add}><label htmlFor="staff-email">Correo del personal</label><div className="actions"><input id="staff-email" type="email" required maxLength={254} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'staff-email-error' : undefined} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /><button className="button button-primary" disabled={busy}>Añadir</button></div>{emailError && <p className="field-error" id="staff-email-error">{emailError}</p>}</form>
    <ul className="staff-list">{staff.map(member => <li key={member.email}><span>{member.email}</span><button className="button button-secondary" disabled={busy} onClick={() => act('staff', 'DELETE', { email: member.email })}>Revocar</button></li>)}</ul>
    {!staff.length && <p className="field-help">Aún no has añadido personal.</p>}
    {message && <p role="status" className="notice">{message}</p>}
  </section>;
}
