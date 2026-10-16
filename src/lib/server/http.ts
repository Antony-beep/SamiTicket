import 'server-only';
import { AppError } from '@/lib/validation';

export async function api(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    const known = error instanceof AppError;
    return Response.json({ message: known ? error.message : 'Ocurrió un error. Intenta nuevamente.', ...(known && error.errors ? { errors: error.errors } : {}) }, {
      status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new AppError('Origen de solicitud inválido.', 403);
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AppError('Se requiere JSON.', 415);
  const raw = await request.text();
  if (raw.length > 20000) throw new AppError('Solicitud demasiado grande.', 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new AppError('JSON inválido.'); }
}
