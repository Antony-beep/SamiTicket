'use client';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { CoverInput } from './cover-input';
import { fieldErrors } from './field-errors';
import { notify } from '@/lib/feedback';
import { HaloProgress } from './ui/halo-progress';

export function CoverManager({ eventId, currentUrl, published }: { eventId: string; currentUrl: string | null; published: boolean }) {
  const router = useRouter(), lock = useRef(false);
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save(remove = false) {
    if (lock.current || (!remove && !file)) return;
    lock.current = true; setBusy(true); setErrors({}); setMessage(remove ? 'Retirando portada…' : 'Generando y guardando ambas portadas WebP…');
    try {
      const data = new FormData(); if (file) data.set('cover', file);
      const result = await clientApi<{ cleanupPending: boolean }>(`/api/events/${eventId}/cover`, remove ? 'DELETE' : 'PUT', remove ? undefined : data);
      setFile(null); setMessage(`Portada ${remove ? 'retirada' : 'guardada'}.${result.cleanupPending ? ' La limpieza de archivos anteriores se reintentará.' : ''}`); notify({title:remove?'Portada retirada':'Portada guardada',description:remove?undefined:'Ambas versiones WebP están listas.',tone:'success'}); router.refresh();
    } catch (error) { setErrors(fieldErrors(error)); setMessage((error as Error).message); document.getElementById('cover')?.focus(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="panel-card"><h2>Portada</h2>
    {published && <p>Puedes reemplazar el afiche. Los demás datos publicados permanecen bloqueados.</p>}
    <CoverInput file={file} currentUrl={currentUrl} onChange={setFile} errors={errors} disabled={busy} />
    <div className="actions"><Button type="button" className="button button-primary" disabled={busy || !file} onClick={() => save()}>Guardar portada</Button>
      {!published && currentUrl && <Button type="button" className="button button-secondary" disabled={busy} onClick={() => save(true)}>Retirar portada</Button>}</div>
    {busy ? <HaloProgress value={null} label={message} /> : message && <p role="status" className="notice">{message}</p>}
  </section>;
}
