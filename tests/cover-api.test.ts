import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: 'owner', row: { owner_id: 'owner', status: 'draft', cover_version: 'version' }, rpc: vi.fn(), replace: vi.fn(), cleanup: vi.fn(), download: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/server/data', () => ({ actor: async () => { if (!state.user) throw new AppError('Inicia sesión.', 401); return state.user; }, rpc: state.rpc, database: () => ({ storage: { from: () => ({ download: state.download }) } }) }));
vi.mock('@/lib/server/covers', () => ({ coverRow: async () => state.row, replaceCover: state.replace, cleanupCovers: state.cleanup }));
import { AppError } from '@/lib/validation';
import { DELETE, GET, PUT } from '@/app/api/events/[id]/cover/route';
const id = '11111111-1111-4111-8111-111111111111', context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  state.user = 'owner'; state.row = { owner_id: 'owner', status: 'draft', cover_version: 'version' };
  for (const mock of [state.rpc, state.replace, state.cleanup, state.download]) mock.mockReset();
  state.download.mockResolvedValue({ data: new Blob(['webp']), error: null }); state.cleanup.mockResolvedValue(true);
});
it('allows private draft images only to the owner, never anonymous or staff', async () => {
  expect((await GET(new Request('http://localhost/api/cover?size=small'), context)).status).toBe(200);
  state.user = 'staff'; expect((await GET(new Request('http://localhost/api/cover'), context)).status).toBe(403);
  state.user = ''; expect((await GET(new Request('http://localhost/api/cover'), context)).status).toBe(401);
  expect(state.download).toHaveBeenCalledTimes(1);
});
it('serves only the requested public variant with no-store and no signed Storage URL', async () => {
  state.row.status = 'published'; state.user = '';
  const response = await GET(new Request('http://localhost/api/cover?size=small'), context);
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/webp'); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(state.download).toHaveBeenCalledWith(`${id}/version/small.webp`);
  expect((await GET(new Request('http://localhost/api/cover?size=invalid'), context)).status).toBe(400);
});
it('validates owner and origin before parsing or converting an upload', async () => {
  const data = new FormData(); data.set('cover', new File(['image'], 'file.png', { type: 'image/png' }));
  const request = () => new Request('http://localhost/api/cover', { method: 'PUT', headers: { origin: 'http://localhost' }, body: data });
  state.user = 'other'; expect((await PUT(request(), context)).status).toBe(403); expect(state.replace).not.toHaveBeenCalled();
  state.user = 'owner'; state.replace.mockResolvedValue({ version: 'new' });
  const result = await PUT(request(), context); expect(result.status).toBe(200); expect(await result.json()).toEqual({ version: 'new' });
  expect(state.replace).toHaveBeenCalledWith('owner', id, expect.any(Buffer));
  expect((await DELETE(new Request('http://localhost/api/cover', { method: 'DELETE', headers: { origin: 'https://foreign.example' } }), context)).status).toBe(403);
});
it('rejects oversized requests before conversion and reports Storage failures', async () => {
  const request = new Request('http://localhost/api/cover', { method: 'PUT', headers: { origin: 'http://localhost', 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(9 * 1024 * 1024) }, body: 'x' });
  expect((await PUT(request, context)).status).toBe(413); expect(state.replace).not.toHaveBeenCalled();
  state.download.mockResolvedValue({ data: null, error: new Error('storage offline') });
  expect((await GET(new Request('http://localhost/api/cover'), context)).status).toBe(503);
});
