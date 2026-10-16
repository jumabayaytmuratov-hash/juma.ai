import { store } from './common.mjs';

const MODELS = { gemini: 'gemini-flash-latest', openai: 'llama-3.3-70b-versatile', anthropic: 'claude-haiku-5-5', pollinations: 'openai', ovh: 'Meta-Llama-3_3-70B-Instruct', auto: 'openai' };

export async function getAI() {
  const s = (await store('secret').get('ai', { type: 'json' })) || {};
  const key = s.key || process.env.AI_API_KEY || '';
  const provider = s.provider || process.env.AI_PROVIDER || (key ? 'gemini' : 'auto');
  return {
    provider,
    model: s.model || process.env.AI_MODEL || MODELS[provider] || MODELS.gemini,
    key,
    base: (s.base || process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  };
}

function build(ai, prompt, stream, max) {
  if (ai.provider === 'gemini')
    return [`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
      { 'x-goog-api-key': ai.key, 'content-type': 'application/json' },
      { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: max } }];
  if (ai.provider === 'anthropic')
    return ['https://api.anthropic.com/v1/messages',
      { 'x-api-key': ai.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      { model: ai.model, max_tokens: max, stream, messages: [{ role: 'user', content: prompt }] }];
  if (ai.provider === 'ovh')
    return ['https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
      { 'content-type': 'application/json', ...(ai.key ? { authorization: 'Bearer ' + ai.key } : {}) },
      { model: ai.model, max_tokens: Math.min(max, 4000), stream, messages: [{ role: 'user', content: prompt }] }];
  if (ai.provider === 'pollinations')
    return ['https://text.pollinations.ai/openai',
      { 'content-type': 'application/json', ...(ai.key ? { authorization: 'Bearer ' + ai.key } : {}) },
      { model: ai.model, max_tokens: max, stream, messages: [{ role: 'user', content: prompt }] }];
  return [ai.base + '/chat/completions',
    { authorization: 'Bearer ' + ai.key, 'content-type': 'application/json' },
    { model: ai.model, max_tokens: max, stream, messages: [{ role: 'user', content: prompt }] }];
}

const delta = (ai, j) =>
  ai.provider === 'gemini' ? (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  : ai.provider === 'anthropic' ? (j.type === 'content_block_delta' ? j.delta?.text || '' : '')
  : j.choices?.[0]?.delta?.content || '';
const whole = (ai, j) =>
  ai.provider === 'anthropic' ? (j.content || []).map((x) => x.text || '').join('')
  : ai.provider === 'gemini' ? delta(ai, j)
  : j.choices?.[0]?.message?.content || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYLESS = ['auto', 'pollinations', 'ovh'];

async function call(prompt, stream, max) {
  const base = await getAI();
  if (!base.key && !KEYLESS.includes(base.provider)) throw new Error('AI калити киритилмаган (админ панел → AI созламалари)');
  const cands = base.provider === 'auto' ? ['pollinations', 'ovh'] : [base.provider];
  let err;
  for (let k = 0; k < cands.length; k++) {
    const p = cands[k];
    const ai = { ...base, provider: p, model: base.provider === 'auto' ? MODELS[p] : base.model };
    try {
      const [url, headers, body] = build(ai, prompt, stream, max);
      const go = () => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      let r = await go();
      if (r.status === 429 && k === cands.length - 1 && KEYLESS.includes(p)) { await sleep(6000); r = await go(); }
      if (r.ok) return [ai, r];
      err = new Error('AI хатолиги (' + p + ') ' + r.status + ': ' + (await r.text()).slice(0, 200));
    } catch (e) { err = e; }
  }
  throw err;
}

export async function aiText(prompt, max = 5000) {
  const [ai, r] = await call(prompt, false, max);
  return whole(ai, await r.json());
}

export async function aiStream(prompt, max = 8000) {
  const [ai, r] = await call(prompt, true, max);
  const enc = new TextEncoder(), dec = new TextDecoder();
  return new ReadableStream({
    async start(ctrl) {
      const rd = r.body.getReader(); let buf = '';
      try {
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
            try { const t = delta(ai, JSON.parse(line.slice(5))); if (t) ctrl.enqueue(enc.encode(t)); } catch {}
          }
        }
      } finally { ctrl.close(); }
    },
  });
}
