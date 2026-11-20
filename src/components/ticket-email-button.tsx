'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';
import { notify } from '@/lib/feedback';

export function TicketEmailButton({ orderId, email }: { orderId: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const lock = useRef(false);

  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('');
    try {
      const res = await clientApi<{ mode: 'resend' | 'simulated'; sentTo: string; note?: string }>(
        `/api/orders/${orderId}/email`,
        'POST'
      );
      const text = res.mode === 'resend'
        ? `Entrada y QR enviados por Resend a ${res.sentTo}.`
        : `Entrada enviada a ${res.sentTo}. ${res.note ?? ''}`.trim();
      setStatus(text);
      notify({
        title: res.mode === 'resend' ? 'Correo enviado con Resend' : 'Correo de entrada procesado',
        description: text,
        tone: 'success',
      });
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <Button variant="outline" type="button" disabled={busy} onClick={send}>
        {busy ? 'Enviando al correo…' : `✉️ Enviar entrada a ${email}`}
      </Button>
      {status && <p className="field-help" role="status" style={{ textAlign: 'center', maxWidth: '380px' }}>{status}</p>}
    </div>
  );
}
