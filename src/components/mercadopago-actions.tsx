'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { HaloProgress } from '@/components/ui/halo-progress';
import { clientApi } from '@/lib/client-api';

type PaymentAttempt = 'processing' | 'rejected';
type SimulatedState = 'approved' | 'in_process' | 'rejected' | 'refunded';

const attemptMessage = {
  processing: 'Mercado Pago sigue procesando el pago. Usa Consultar pago más tarde para ver el resultado.',
  rejected: 'Mercado Pago rechazó el intento. Puedes reintentar durante la reserva.',
} satisfies Record<PaymentAttempt, string>;

export function MercadoPagoActions({ orderId, eventId, pending, isPaid = false, demoEnabled = false, paymentAttempt, returnedFromCheckout = false }: {
  orderId: string; eventId?: string; pending: boolean; isPaid?: boolean; demoEnabled?: boolean; paymentAttempt?: PaymentAttempt | null; returnedFromCheckout?: boolean;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const checkedOrder = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checkedAttempt, setCheckedAttempt] = useState<PaymentAttempt | null | undefined>();

  useEffect(() => {
    if (!pending && eventId) {
      sessionStorage.removeItem(`samiticket:checkout:${eventId}`);
    }
  }, [pending, eventId]);

  async function simulate(state: SimulatedState) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await clientApi<{ status: string }>(`/api/orders/${orderId}/simulate`, 'POST', { state });
      if (result.status === 'paid') {
        if (eventId) sessionStorage.removeItem(`samiticket:checkout:${eventId}`);
        setCheckedAttempt(null);
        setMessage('Pago simulado aprobado. Tu entrada está lista.');
      } else if (result.status === 'in_process') {
        setCheckedAttempt('processing');
        setMessage(attemptMessage.processing);
      } else if (result.status === 'rejected') {
        setCheckedAttempt('rejected');
        setMessage(attemptMessage.rejected);
      } else if (result.status === 'refunded') {
        if (eventId) sessionStorage.removeItem(`samiticket:checkout:${eventId}`);
        setCheckedAttempt(null);
        setMessage('Reembolso de prueba confirmado. El QR quedó revocado.');
      }
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function run(action: 'checkout' | 'refresh') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await clientApi<{ url?: string; status?: string; paymentAttempt?: PaymentAttempt | null; paymentState?: string | null }>(`/api/orders/${orderId}/${action}`, 'POST');
      if (action === 'checkout' && result.url) {
        window.location.assign(result.url);
        return;
      }
      const attempt = result.paymentAttempt ?? null;
      setCheckedAttempt(attempt);
      if (result.status === 'paid') setMessage('Pago confirmado. Tu entrada está lista.');
      else if (attempt) setMessage(attemptMessage[attempt]);
      else if (result.status === 'pending' && !result.paymentState) setMessage('Aún no hay un pago confirmado para esta orden. Si ya pagaste, abre el comprobante original en ese mismo navegador.');
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const checkOnReturn = useEffectEvent(() => {
    if (checkedOrder.current === orderId || lock.current) return;
    checkedOrder.current = orderId;
    void run('refresh');
  });

  useEffect(() => {
    if (pending && returnedFromCheckout) checkOnReturn();
  }, [orderId, pending, returnedFromCheckout]);

  const currentAttempt = checkedAttempt === undefined ? paymentAttempt : checkedAttempt;
  const statusMessage = message || (pending && currentAttempt && attemptMessage[currentAttempt]);
  return <div className="field-group">
    <p>Pago de prueba en Mercado Pago. El cupo queda reservado hasta 30 minutos. Vuelve para confirmar el pago y descargar el QR.</p>
    <div className="actions mp-actions">
      {pending && currentAttempt !== 'processing' && <Button disabled={busy} data-mp-checkout-cta="checkout-pro" onClick={() => run('checkout')}>Pagar con Mercado Pago</Button>}
      <Button variant="outline" disabled={busy} onClick={() => run('refresh')}>Consultar pago</Button>
    </div>
    {demoEnabled && (pending || isPaid) && <div className="actions mp-actions">
      {pending && <>
        <Button variant="outline" disabled={busy} onClick={() => simulate('approved')}>Simular aprobación MP</Button>
        <Button variant="outline" disabled={busy} onClick={() => simulate('in_process')}>Simular en proceso</Button>
        <Button variant="outline" disabled={busy} onClick={() => simulate('rejected')}>Simular rechazo MP</Button>
      </>}
      {isPaid && <Button variant="outline" disabled={busy} onClick={() => simulate('refunded')}>Simular reembolso MP</Button>}
    </div>}
    {busy && <HaloProgress value={null} label="Consultando Mercado Pago…" />}
    {statusMessage && <p role="status">{statusMessage}</p>}
  </div>;
}
