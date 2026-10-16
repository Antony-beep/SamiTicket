import { actor } from '@/lib/server/data';
import { api, sameOrigin } from '@/lib/server/http';
import { coverRow, replaceCover, cleanupCovers } from '@/lib/server/covers';
import { database, rpc } from '@/lib/server/data';
import { AppError, uuid } from '@/lib/validation';
import { maxUploadBytes } from '@/lib/server/images';

export const runtime = 'nodejs';
export async function GET(request: Request, context: RouteContext<'/api/events/[id]/cover'>) {
  return api(async () => {
    const id = uuid((await context.params).id), row = await coverRow(id);
    if (row.status !== 'published' && row.owner_id !== await actor()) throw new AppError('No tienes permiso para esta portada.', 403);
    const size = new URL(request.url).searchParams.get('size') ?? 'large';
    if (!['small', 'large'].includes(size)) throw new AppError('Tamaño de portada inválido.');
    if (!row.cover_version) throw new AppError('Este evento no tiene portada.', 404);
    const file = await database().storage.from('event-covers').download(`${id}/${row.cover_version}/${size}.webp`);
    if (file.error) throw new AppError('No pudimos cargar la portada. Reintenta.', 503);
    return new Response(file.data, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
export async function PUT(request: Request, context: RouteContext<'/api/events/[id]/cover'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor(), id = uuid((await context.params).id);
    const row = await coverRow(id);
    if (row.owner_id !== user) throw new AppError('No tienes permiso para este evento.', 403);
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new AppError('Se requiere una imagen.', 415);
    if (Number(request.headers.get('content-length')) > maxUploadBytes + 65536) throw new AppError('La imagen debe pesar hasta 8 MiB.', 413);
    // Bound chunked requests too; formData() alone would buffer an unbounded body.
    const reader = request.body?.getReader();
    if (!reader) throw new AppError('Falta la imagen.');
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxUploadBytes + 65536) { await reader.cancel(); throw new AppError('La imagen debe pesar hasta 8 MiB.', 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
    const file = form.get('cover');
    if (!(file instanceof File)) throw new AppError('Selecciona una portada.', 400, { cover: 'Selecciona una portada.' });
    return Response.json(await replaceCover(user, id, Buffer.from(await file.arrayBuffer())));
  });
}
export async function DELETE(request: Request, context: RouteContext<'/api/events/[id]/cover'>) {
  return api(async () => {
    sameOrigin(request);
    const user = await actor(), id = uuid((await context.params).id), row = await coverRow(id);
    await rpc('set_event_cover', { p_actor: user, p_event: id, p_expected: row.cover_version, p_version: null });
    return Response.json({ removed: true, cleanupPending: !(await cleanupCovers(id)) });
  });
}
