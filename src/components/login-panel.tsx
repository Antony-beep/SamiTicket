"use client";

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormEvent, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { email as validateEmail, safeNext } from "@/lib/validation";
import { HaloCard } from './ui/halo-card';
import { HaloProgress } from './ui/halo-progress';
import { notify } from '@/lib/feedback';
import { ReniecVerification, type VerifiedReniecIdentity } from './reniec-verification';

type Provider = "google" | "facebook" | "azure";

export function LoginPanel({ next = '/panel', authError = false, demoEnabled = false }: {
  next?: string; authError?: boolean; demoEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [reniec, setReniec] = useState<VerifiedReniecIdentity | null>(null);
  const [message, setMessage] = useState(authError ? 'No pudimos completar el acceso. Solicita un nuevo enlace.' : '');
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const configured = isSupabaseConfigured();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [emailError, setEmailError] = useState('');

  async function signInWithProvider(provider: Provider) {
    if (lock.current) return;
    if (!configured) {
      setMessage("Configura Supabase y los proveedores OAuth en .env.local para activar este acceso.");
      return;
    }

    lock.current = true; setBusy(true); setMessage('Conectando…');
    try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback() },
    });
    if (error) setMessage(error.message);
    } catch { setMessage('No pudimos conectar. Reintenta.'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    let address: string;
    try { address = validateEmail(email); setEmailError(''); }
    catch (error) { setEmailError((error as Error).message); document.getElementById('login-email')?.focus(); return; }
    if (!configured) {
      setMessage("Configura Supabase en .env.local para enviar enlaces de acceso.");
      return;
    }

    lock.current = true; setBusy(true); setMessage('Enviando enlace…');
    try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: reniec
        ? { emailRedirectTo: callback(), data: { full_name: reniec.name, dni: reniec.dni } }
        : { emailRedirectTo: callback() },
    });
    setMessage(error ? error.message : "Revisa tu correo: te enviamos un enlace seguro para ingresar.");
    notify({title:error ? 'No pudimos enviar el enlace' : 'Revisa tu correo',description:error ? error.message : 'Te enviamos un enlace seguro para ingresar.',tone:error?'error':'success'});
    } catch { setMessage('No pudimos conectar. Reintenta.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <HaloCard className="auth-card" aria-label="Acceso de organizadores" padding="none">
      <div>
        <span className="eyebrow">Acceso de organizadores</span>
        <h2>Tu próximo evento empieza aquí</h2>
        <p>Ingresa sin contraseña o utiliza tu cuenta favorita.</p>
      </div>
      <ReniecVerification
        required={false}
        demoEnabled={demoEnabled}
        disabled={busy}
        verified={reniec}
        onVerified={setReniec}
      />
      <form noValidate onSubmit={signInWithEmail} className="auth-email-form">
        <label htmlFor="login-email">Correo electrónico</label>
        <div className="email-row">
          <Input id="login-email" type="email" required maxLength={254} autoComplete="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'login-email-error' : undefined} disabled={busy} value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(''); }} placeholder="organizador@correo.com" />
          <Button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Conectando…' : 'Enviar enlace'}</Button>
        </div>
        {emailError && <p className="field-error" id="login-email-error">{emailError}</p>}
      </form>
      <div className="divider"><span>o continúa con</span></div>
      <div className="provider-grid">
        <Button variant="outline" type="button" disabled={busy} onClick={() => signInWithProvider("google")}>Google</Button>
        <Button variant="outline" type="button" disabled={busy} onClick={() => signInWithProvider("facebook")}>Facebook</Button>
        <Button variant="outline" type="button" disabled={busy} onClick={() => signInWithProvider("azure")}>Microsoft</Button>
      </div>
      {message && <p className="auth-message" role="status">{message}</p>}
      {busy && <HaloProgress value={null} label="Conectando…" />}
      {!configured && <p className="setup-message">Modo demostración: añade las variables de Supabase para activar el inicio de sesión.</p>}
    </HaloCard>
  );
}
