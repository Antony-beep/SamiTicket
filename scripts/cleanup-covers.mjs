import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configura Supabase y SUPABASE_SERVICE_ROLE_KEY en .env.local.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let remaining = 0, cleaned = 0;
// Only jobs already eligible are touched; active versions are always preserved.
for (;;) {
  const jobs = await db.from('cover_cleanup').select('event_id,version').lte('not_before', new Date().toISOString()).limit(50);
  if (jobs.error) throw new Error('No pudimos leer la cola. Revisa migración y conexión.');
  if (!jobs.data.length) break;
  for (const job of jobs.data) {
    const active = await db.from('events').select('cover_version').eq('id', job.event_id).maybeSingle();
    if (active.error) { remaining++; continue; }
    if (active.data?.cover_version !== job.version) {
      const files = ['small', 'large'].map(size => `${job.event_id}/${job.version}/${size}.webp`);
      const removed = await db.storage.from('event-covers').remove(files);
      if (removed.error) { remaining++; continue; }
    }
    const removed = await db.from('cover_cleanup').delete().eq('event_id', job.event_id).eq('version', job.version);
    if (removed.error) remaining++; else cleaned++;
  }
  if (remaining || jobs.data.length < 50) break;
}
console.log(`Limpiezas completadas: ${cleaned}. Fallos pendientes: ${remaining}.`);
if (remaining) process.exitCode = 1;
