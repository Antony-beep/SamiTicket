'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HaloProgress } from '@/components/ui/halo-progress';
import { clientApi } from '@/lib/client-api';

export type VerifiedReniecIdentity = {
  dni: string;
  name: string;
  verificationToken: string;
};

type SessionState = {
  sessionToken: string;
  deepLink: string;
  qrDataUrl: string;
};

export function ReniecVerification({
  required = false,
  demoEnabled = false,
  disabled = false,
  verified,
  error,
  onVerified,
}: {
  required?: boolean;
  demoEnabled?: boolean;
  disabled?: boolean;
  verified: VerifiedReniecIdentity | null;
  error?: string;
  onVerified: (identity: VerifiedReniecIdentity | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [dniInput, setDniInput] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled || lock.current) return;
      try {
        const res = await clientApi<{ status: 'ACTIVE' | 'EXPIRED' | 'VERIFIED'; identity?: VerifiedReniecIdentity }>(
          '/api/security/reniec',
          'POST',
          { action: 'status', sessionToken: session.sessionToken }
        );
        if (cancelled) return;
        if (res.status === 'VERIFIED' && res.identity) {
          setSession(null);
          setMessage('Identidad DNId verificada con RENIEC.');
          onVerified(res.identity);
        } else if (res.status === 'EXPIRED') {
          setSession(null);
          setMessage('La solicitud en Perú Pass expiró. Inicia una nueva verificación.');
        }
      } catch (err) {
        if (!cancelled) setMessage((err as Error).message);
      }
    }, 2800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, onVerified]);

  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('Iniciando solicitud DNId con RENIEC…');
    try {
      const res = await clientApi<{ sessionToken: string; deepLink: string; qrDataUrl: string }>(
        '/api/security/reniec',
        'POST',
        { action: 'start' }
      );
      setSession(res);
      setMessage('Escanea el QR con la app Perú Pass o ábrela desde tu celular.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function simulate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const res = await clientApi<{ status: 'VERIFIED'; identity: VerifiedReniecIdentity }>(
        '/api/security/reniec',
        'POST',
        { action: 'simulate' }
      );
      setSession(null);
      setMessage('DNId simulado verificado (SD-JWT RENIEC).');
      onVerified(res.identity);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function lookupDni() {
    if (lock.current) return;
    const clean = dniInput.trim();
    if (!/^\d{8}$/.test(clean)) {
      setMessage('Ingresa un DNI válido de 8 dígitos.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage('Consultando DNI…');
    try {
      const res = await clientApi<{ status: 'VERIFIED'; identity: VerifiedReniecIdentity }>(
        '/api/security/reniec',
        'POST',
        { action: 'lookup', dni: clean }
      );
      setSession(null);
      setMessage('Nombre autocompletado desde DNI.');
      onVerified(res.identity);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="field-group" data-reniec-verification={required ? 'required' : 'optional'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span>{required ? 'Verificación DNId (RENIEC · Obligatoria)' : 'Autocompletar con DNId (RENIEC · Opcional)'}</span>
        {verified && (
          <Button
            variant="outline"
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              onVerified(null);
              setMessage('');
            }}
          >
            Cambiar DNId
          </Button>
        )}
      </div>

      {verified ? (
        <p className="notice" role="status">
          DNId verificado: <strong>{verified.name}</strong> · DNI <strong>{verified.dni}</strong>
        </p>
      ) : (
        <>
          <div className="email-row" style={{ marginBottom: '8px' }}>
            <Input
              aria-label="Número de DNI"
              placeholder="DNI (8 dígitos)"
              inputMode="numeric"
              maxLength={8}
              disabled={disabled || busy}
              value={dniInput}
              onChange={e => setDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void lookupDni();
                }
              }}
            />
            <Button variant="outline" type="button" disabled={disabled || busy || dniInput.length !== 8} onClick={lookupDni}>
              Autocompletar con DNI
            </Button>
          </div>
          <div className="actions">
            <Button variant="outline" type="button" disabled={disabled || busy} onClick={start}>
              {session ? 'Renovar QR Perú Pass' : 'Verificar con Perú Pass'}
            </Button>
            {demoEnabled && (
              <Button variant="outline" type="button" disabled={disabled || busy} onClick={simulate}>
                Simular DNId (RENIEC)
              </Button>
            )}
            {session && (
              <Button variant="outline" type="button" disabled={busy} onClick={() => { setSession(null); setMessage(''); }}>
                Cancelar
              </Button>
            )}
          </div>

          {session && (
            <div className="ticket-qr" style={{ marginTop: '12px' }}>
              <div className="ticket-qr-container">
                <Image
                  src={session.qrDataUrl}
                  width={200}
                  height={200}
                  unoptimized
                  alt="QR OpenID4VP para verificar DNId en la aplicación Perú Pass de RENIEC"
                />
              </div>
              <a className="button button-secondary" href={session.deepLink}>
                Abrir Perú Pass en este dispositivo
              </a>
            </div>
          )}
        </>
      )}

      {busy && <HaloProgress value={null} label="Consultando verificador RENIEC…" />}
      {message && !verified && <p className="field-help" role="status">{message}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
