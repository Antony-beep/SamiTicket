import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, DEMO_OWNER_EMAIL: ownerEmail } = process.env;
if (!url || !key || !ownerEmail) {
  console.error('Configura NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y DEMO_OWNER_EMAIL.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const eventId = '55555555-5555-4555-8555-555555555555';
async function main() {
  let owner;
  for (let page = 1; ; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error('No pudimos consultar las cuentas. Revisa la clave administrativa.');
    owner = result.data.users.find(user => user.email?.toLowerCase() === ownerEmail.toLowerCase() && user.email_confirmed_at);
    if (owner || result.data.users.length < 100) break;
  }
  if (!owner) throw new Error('DEMO_OWNER_EMAIL debe ser una cuenta existente y verificada. Inicia sesión primero.');
  const existing = await db.from('events').select('slug,owner_id,status').eq('id', eventId).maybeSingle();
  if (existing.error) throw new Error('Aplica primero supabase/migrations/202610160001_mvp.sql.');
  if (existing.data) {
    if (existing.data.owner_id !== owner.id) throw new Error('La semilla ya pertenece a otro organizador. No se modificó.');
    console.log(`La semilla ya existe (${existing.data.status}): /panel/${eventId}`);
    return;
  }
  const day = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const draft = await db.rpc('save_event', { p_actor: owner.id, p_id: eventId, p_data: {
    title: 'Noche Andina en Huancayo', description: 'Demo de SamiTicket: música local y control de ingreso con QR. Todos los pagos son simulados.',
    starts_at: new Date(`${day}T20:00:00-05:00`).toISOString(), venue: 'Casa Cultural Wanka', address: 'Av. Giráldez 590, Huancayo',
    city: 'Huancayo', latitude: -12.06513, longitude: -75.20486, price_cents: 2500, capacity: 180, category: 'Música y cultura', outdoor: false,
  } });
  if (draft.error) throw new Error('No pudimos crear la semilla. Comprueba la migración y las credenciales.');
  console.log(`Borrador demo creado para ${day}. Añade una portada y publica desde /panel/${eventId}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
