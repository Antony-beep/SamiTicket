'use client';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { notify } from '@/lib/feedback';

export function PaymentActions({ orderId, eventId }: { orderId: string; eventId: string }) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function simulate(approve: boolean) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try {
      await clientApi(`/api/orders/${orderId}/simulate`, 'POST', { approve });
      sessionStorage.removeItem(`samiticket:checkout:${eventId}`);
      notify({title:approve?'Pago simulado aprobado':'Pago simulado rechazado',description:approve?'Tu entrada está lista. Puedes descargar el QR.':'No se realizó ningún cobro.',tone:approve?'success':'info'});
      router.refresh();
    } catch (error) { setMessage((error as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div><p>El cupo se confirma al aprobar este pago simulado.</p><div className="actions"><Button className="button button-primary" disabled={busy} onClick={() => simulate(true)}>{busy ? 'Procesando…' : 'Simular pago aprobado'}</Button><Button className="button button-secondary" disabled={busy} onClick={() => simulate(false)}>Simular pago rechazado</Button></div>{message && <p className="notice notice-error" role="alert">{message}</p>}</div>;
}
