'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';

export function DeleteEvent({ id, title, hasOrders }: { id: string; title: string; hasOrders: boolean }) {
  const router = useRouter(), lock = useRef(false), cancel = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { if (confirm) cancel.current?.focus(); }, [confirm]);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await clientApi(`/api/events/${id}`, 'DELETE'); router.push('/panel?deleted=1'); router.refresh(); }
    catch (error) { setMessage((error as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="panel-card"><h2>Eliminar evento</h2>
    <p>Solo puedes eliminarlo si no tiene ninguna orden, incluidas pendientes, aprobadas o rechazadas.</p>
    {hasOrders ? <p className="notice">Este evento tiene órdenes registradas. No se puede eliminar.</p> : <>
      {!confirm && <button ref={trigger} className="button button-danger" type="button" onClick={() => setConfirm(true)}>Eliminar evento</button>}
      {confirm && <div className="notice notice-error" role="region" aria-label="Confirmar eliminación"><h3>{title || 'Evento sin nombre'}</h3>
        <p>Eliminarás este evento y su configuración. Su enlace dejará de funcionar y no podrás recuperarlo.</p>
        <div className="actions"><button ref={cancel} type="button" className="button button-secondary" disabled={busy} onClick={() => { setConfirm(false); requestAnimationFrame(() => trigger.current?.focus()); }}>Conservar evento</button>
          <button type="button" className="button button-danger" disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Eliminar definitivamente'}</button></div>
      </div>}
    </>}
    {message && <p role="alert" className="notice notice-error">{message}</p>}
  </section>;
}
