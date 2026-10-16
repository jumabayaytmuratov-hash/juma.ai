import { getStore } from '@netlify/blobs';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const store = (n) => getStore({ name: n, consistency: 'strong' });
export const DEF = { lesson: 10000, year: 290000, free: 1, card: '', tg: 'JAytmuratov', dailyLimit: 30, prompt: '' };
export const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function getCfg() {
  const c = await store('config').get('main', { type: 'json' });
  return { ...DEF, ...(c || {}) };
}

const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (exp) => createHmac('sha256', secret()).update(String(exp)).digest('hex');
export function mkToken() {
  const exp = Date.now() + 12 * 3600e3;
  return exp + '.' + sign(exp);
}
export function isAdmin(req) {
  if (!secret()) return false;
  const t = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export const okDev = (d) => typeof d === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(d);
export const getLic = async (d) => (await store('licenses').get(d, { type: 'json' })) || { used: 0, credit: 0, until: 0 };
export const putLic = (d, l) => store('licenses').setJSON(d, l);
export const leftOf = (l, c) => Math.max(0, c.free + l.credit - l.used);
export const premium = (l) => l.until > Date.now();
