import 'server-only';
import { randomUUID } from 'node:crypto';
import { database, databaseError, rpc } from './data';
import { AppError } from '@/lib/validation';
import { convertCover } from './images';

export const coverPaths = (eventId: string, version: string) => ['small', 'large'].map(size => `${eventId}/${version}/${size}.webp`);
export async function cleanupCovers(eventId?: string) {
  try {
    const db = database();
    let query = db.from('cover_cleanup').select('event_id,version').lte('not_before', new Date().toISOString()).limit(50);
    if (eventId) query = query.eq('event_id', eventId);
    const pending = await query;
    if (pending.error) return false;
    let clean = true;
    for (const item of pending.data) {
      const active = await db.from('events').select('cover_version').eq('id', item.event_id).maybeSingle();
      if (active.error) { clean = false; continue; }
      if (active.data?.cover_version !== item.version) {
        const removed = await db.storage.from('event-covers').remove(coverPaths(item.event_id, item.version));
        if (removed.error) { clean = false; continue; }
      }
      const removedJob = await db.from('cover_cleanup').delete().eq('event_id', item.event_id).eq('version', item.version);
      if (removedJob.error) clean = false;
    }
    return clean;
  } catch { return false; }
}
export async function coverRow(id: string) {
  const { data, error } = await database().from('events').select('owner_id,status,cover_version').eq('id', id).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new AppError('Evento no encontrado.', 404);
  return data;
}
export async function replaceCover(user: string, id: string, input: Buffer) {
  const row = await coverRow(id);
  if (row.owner_id !== user) throw new AppError('No tienes permiso para este evento.', 403);
  const images = await convertCover(input);
  const version = randomUUID(), db = database();
  const job = await db.from('cover_cleanup').insert({ event_id: id, version });
  if (job.error) databaseError(job.error);
  try {
    const paths = coverPaths(id, version);
    for (const [i, size] of (['small', 'large'] as const).entries()) {
      const uploaded = await db.storage.from('event-covers').upload(paths[i], images[size], { contentType: 'image/webp', cacheControl: '0', upsert: false });
      if (uploaded.error) throw new AppError('No pudimos guardar las imágenes. Conservamos el borrador y la portada anterior.', 503);
    }
    await rpc('set_event_cover', { p_actor: user, p_event: id, p_expected: row.cover_version, p_version: version });
  } catch (error) {
    // A lost RPC response may have committed: cleanup always checks the active pointer.
    await db.from('cover_cleanup').update({ not_before: new Date().toISOString() }).eq('event_id', id).eq('version', version);
    await cleanupCovers(id);
    throw error;
  }
  return { version, cleanupPending: !(await cleanupCovers(id)) };
}
