import { store, getLic, putLic, okDev, json } from '../lib/common.mjs';
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!okDev(b.d)) return json({ error: 'bad' }, 400);
  const k = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cs = store('codes');
  const c = k && (await cs.get(k, { type: 'json' }));
  if (!c || c.used) return json({ error: 'Код нотўғри ёки ишлатилган' }, 400);
  c.used = true; c.by = b.d; c.at = Date.now();
  await cs.setJSON(k, c);
  const l = await getLic(b.d);
  if (c.t === 'y') l.until = Math.max(Date.now(), l.until) + 365 * 864e5; else l.credit += 1;
  await putLic(b.d, l);
  return json({ ok: true, type: c.t });
};
export const config = { path: '/api/redeem' };
