'use client';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { clientApi } from '@/lib/client-api';
import { qrToken } from '@/lib/validation';
import { FieldError, fieldErrors } from './field-errors';

type ScanResult = { status: 'accepted' | 'used' | 'invalid' | 'wrong_event'; checkedAt?: string };
const labels = { accepted: 'Ingreso autorizado', used: 'Esta entrada ya fue usada', invalid: 'QR inválido', wrong_event: 'Esta entrada pertenece a otro evento' };
export function Scanner({ eventId }: { eventId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stop = useCallback(() => {
    generation.current++;
    controls.current?.stop(); controls.current = null;
    const stream = video.current?.srcObject;
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
    setCamera(false);
  }, []);
  useEffect(() => () => { generation.current++; controls.current?.stop(); }, []);
  async function validate(value: string) {
    if (locked.current) return;
    stop(); setMessage(''); setResult(null); setErrors({});
    if (!navigator.onLine) { setMessage('Sin conexión. Conéctate a internet antes de validar.'); return; }
    locked.current = true; setBusy(true);
    try { setResult(await clientApi<ScanResult>(`/api/events/${eventId}/check-in`, 'POST', { token: qrToken(value) })); }
    catch (error) { setErrors(fieldErrors(error)); setMessage((error as Error).message || 'No pudimos confirmar el ingreso. Reintenta con internet.'); document.getElementById('manual-token')?.focus(); }
    finally { locked.current = false; setBusy(false); }
  }
  async function start() {
    if (locked.current) return;
    stop(); setMessage(''); setResult(null);
    if (!navigator.onLine) { setMessage('Sin conexión. Conéctate a internet antes de escanear.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('Cámara no disponible. Usa localhost o HTTPS y permite el acceso, o ingresa el token.'); return; }
    const current = generation.current;
    setCamera(true);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (current !== generation.current || !video.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, found => {
        if (found && current === generation.current) void validate(found.getText());
      });
      if (current !== generation.current) scanner.stop(); else controls.current = scanner;
    } catch {
      if (current === generation.current) { stop(); setMessage('No pudimos abrir la cámara. Revisa el permiso o ingresa el token manualmente.'); }
    }
  }
  function manual(event: FormEvent) { event.preventDefault(); void validate(token); }
  return <div className="scanner">
    <div className="actions"><button className="button button-primary" disabled={busy || camera} onClick={start}>Abrir cámara</button>{camera && <button className="button button-secondary" onClick={stop}>Cerrar cámara</button>}</div>
    <video ref={video} className={camera ? 'scanner-video' : 'scanner-video hidden'} autoPlay muted playsInline aria-label="Cámara para escanear entradas" />
    <form noValidate onSubmit={manual}><div className="field-group"><label htmlFor="manual-token">Token de la entrada</label><input id="manual-token" aria-invalid={Boolean(errors.token)} aria-describedby={errors.token ? 'token-error' : undefined} value={token} onChange={e => setToken(e.target.value)} required maxLength={64} autoComplete="off" placeholder="Pega los 64 caracteres del QR" /><FieldError name="token" errors={errors} /></div><button className="button button-secondary" disabled={busy} type="submit">{busy ? 'Validando…' : 'Validar token'}</button></form>
    {result && <div role="status" className={`notice ${result.status === 'accepted' ? 'notice-success' : 'notice-error'}`}><strong>{labels[result.status]}</strong>{result.checkedAt && <p>{new Date(result.checkedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>}</div>}
    {message && <p role="alert" className="notice notice-error">{message}</p>}
  </div>;
}
