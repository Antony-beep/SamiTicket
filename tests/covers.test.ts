import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ active: 'old', upload: vi.fn(), remove: vi.fn(), rpc: vi.fn(), jobs: [] as { event_id: string; version: string }[], row: { owner_id: 'owner', status: 'draft', cover_version: 'old' } }));
vi.mock('@/lib/server/images', () => ({ convertCover: async () => ({ small: Buffer.from('small'), large: Buffer.from('large') }) }));
vi.mock('@/lib/server/data', () => ({ rpc: state.rpc, databaseError: () => { throw new Error('DB'); }, database: () => ({
  storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
  from: (table: string) => {
    let listing = false;
    const q = { select: () => q, eq: () => q, lte: () => q, limit: () => { listing = true; return q; }, insert: vi.fn(async () => ({ error: null })),
      update: () => q, delete: () => q,
      maybeSingle: async () => ({ data: table === 'events' ? { ...state.row, cover_version: state.active } : null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: listing ? state.jobs : null, error: null }) };
    return q;
  },
}) }));
import { cleanupCovers, replaceCover } from '@/lib/server/covers';
beforeEach(() => {
  state.active = 'old'; state.jobs = []; state.upload.mockReset(); state.remove.mockReset(); state.rpc.mockReset();
  state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null }); state.rpc.mockResolvedValue(null);
});
it('keeps the old pointer when the second upload fails and never calls the swap', async () => {
  state.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('offline') });
  await expect(replaceCover('owner', 'event', Buffer.from('input'))).rejects.toThrow('portada anterior');
  expect(state.rpc).not.toHaveBeenCalled(); expect(state.active).toBe('old');
});
it('swaps the pointer only after both uploads and queues cleanup failures for retry', async () => {
  state.jobs = [{ event_id: 'event', version: 'obsolete' }]; state.remove.mockResolvedValue({ error: new Error('offline') });
  const result = await replaceCover('owner', 'event', Buffer.from('input'));
  expect(result.cleanupPending).toBe(true); expect(state.upload).toHaveBeenCalledTimes(2);
  expect(state.rpc).toHaveBeenCalledWith('set_event_cover', expect.objectContaining({ p_expected: 'old', p_version: result.version }));
});
it('never deletes the active version after an ambiguous committed response', async () => {
  state.jobs = [{ event_id: 'event', version: 'old' }];
  expect(await cleanupCovers()).toBe(true); expect(state.remove).not.toHaveBeenCalled();
});
