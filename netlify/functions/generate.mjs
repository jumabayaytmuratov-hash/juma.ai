import { getCfg, store, okDev, json } from '../lib/common.mjs';
import { aiStream } from '../lib/ai.mjs';
import { DEFAULT_PROMPT, LANGS } from '../lib/prompt.mjs';

const clip = (v, n) => String(v || '').replace(/[\r\n]+/g, ' ').slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!okDev(b.d)) return json({ error: 'bad' }, 400);
  const topic = clip(b.topic, 200);
  if (!topic) return json({ error: 'Mavzuni kiriting' }, 400);

  const cfg = await getCfg();
  const day = new Date().toISOString().slice(0, 10);
  const us = store('usage'), key = b.d + ':' + day;
  const n = +(await us.get(key)) || 0;
  if (n >= cfg.dailyLimit) return json({ error: "Bugungi limit tugadi, ertaga qayta urinib ko'ring" }, 429);

  const L = LANGS[b.lang] || LANGS.uz;
  let tpl = cfg.prompt || DEFAULT_PROMPT;
  if (!tpl.includes('{TIL}')) tpl += '\nМуҳим: ' + L.til + '.';
  const prompt = tpl
    .replaceAll('{TIL}', L.til).replaceAll('{XARITA}', L.xarita).replaceAll('{USTUN}', L.ustun)
    .replaceAll('{FAN}', clip(b.fan, 60)).replaceAll('{SINF}', clip(b.sinf, 4))
    .replaceAll('{MAVZU}', topic).replaceAll('{VAQT}', clip(b.vaqt, 4));
  try {
    const out = await aiStream(prompt);
    await us.set(key, String(n + 1));
    return new Response(out, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
export const config = { path: '/api/generate' };
