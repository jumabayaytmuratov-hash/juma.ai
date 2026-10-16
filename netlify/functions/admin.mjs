import { randomInt, timingSafeEqual } from 'node:crypto';
import { DEF, getCfg, store, mkToken, isAdmin, json } from '../lib/common.mjs';
import { getAI, aiText } from '../lib/ai.mjs';
import { DEFAULT_PROMPT } from '../lib/prompt.mjs';

const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const mkCode = () => Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join('');

export default async (req) => {
  const path = new URL(req.url).pathname;
  let b = {}; if (req.method === 'POST') { try { b = await req.json(); } catch {} }

  if (path === '/api/admin/login') {
    const pw = process.env.ADMIN_PASSWORD || '';
    await new Promise((r) => setTimeout(r, 600));
    if (!pw || !same(String(b.password || ''), pw)) return json({ error: 'Парол нотўғри' }, 401);
    return json({ token: mkToken() });
  }
  if (!isAdmin(req)) return json({ error: 'auth' }, 401);

  if (path === '/api/admin/config') {
    if (req.method === 'POST') {
      const cur = await getCfg();
      const num = (v, d) => (Number.isFinite(+v) && +v >= 0 ? Math.round(+v) : d);
      const next = {
        lesson: num(b.lesson, cur.lesson), year: num(b.year, cur.year), free: num(b.free, cur.free),
        dailyLimit: num(b.dailyLimit, cur.dailyLimit),
        card: String(b.card ?? cur.card).slice(0, 40),
        prompt: String(b.prompt ?? cur.prompt).trim() === DEFAULT_PROMPT.trim() ? '' : String(b.prompt ?? cur.prompt).slice(0, 8000),
        tg: String(b.tg ?? cur.tg).replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || DEF.tg,
      };
      await store('config').setJSON('main', next);
      return json(next);
    }
    return json({ ...(await getCfg()), defaultPrompt: DEFAULT_PROMPT });
  }
  if (path === '/api/admin/ai') {
    const ss = store('secret'), cur = (await ss.get('ai', { type: 'json' })) || {};
    if (req.method === 'POST') {
      if (b.test) { try { return json({ ok: true, text: (await aiText('Salom deb bir jumla yoz.', 300)).slice(0, 80) }); } catch (e) { return json({ error: String(e.message || e) }, 502); } }
      const next = { ...cur, provider: ['auto', 'pollinations', 'ovh', 'gemini', 'openai', 'anthropic'].includes(b.provider) ? b.provider : cur.provider || 'gemini', model: String(b.model ?? cur.model ?? '').trim().slice(0, 100), base: String(b.base ?? cur.base ?? '').trim().slice(0, 200) };
      if (b.key) next.key = String(b.key).trim().slice(0, 300);
      await ss.setJSON('ai', next);
      return json({ ok: true });
    }
    const ai = await getAI();
    return json({ provider: ai.provider, model: cur.model || '', effectiveModel: ai.model, base: cur.base || '', hasKey: !!ai.key, keyTail: ai.key ? ai.key.slice(-4) : '' });
  }
  if (path === '/api/admin/codes') {
    const cs = store('codes');
    if (req.method === 'POST') {
      if (b.del) { await cs.delete(String(b.del).toUpperCase()); return json({ ok: true }); }
      const t = b.t === 'y' ? 'y' : 'l', n = Math.min(20, Math.max(1, +b.count || 1)), made = [];
      for (let i = 0; i < n; i++) { const k = mkCode(); await cs.setJSON(k, { t, used: false, created: Date.now() }); made.push(k); }
      return json({ made });
    }
    const { blobs } = await cs.list();
    const items = await Promise.all(blobs.map(async (x) => ({ code: x.key, ...(await cs.get(x.key, { type: 'json' })) })));
    items.sort((a, c) => (c.created || 0) - (a.created || 0));
    return json({ items });
  }
  return json({ error: 'not found' }, 404);
};
export const config = { path: ['/api/admin/login', '/api/admin/config', '/api/admin/ai', '/api/admin/codes'] };
