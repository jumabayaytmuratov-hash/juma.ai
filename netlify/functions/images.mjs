import { okDev, json } from '../lib/common.mjs';
import { aiText } from '../lib/ai.mjs';
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!okDev(b.d) || !Array.isArray(b.captions) || !b.captions.length) return json({ error: 'bad' }, 400);
  const caps = b.captions.slice(0, 3).map((c) => String(c).slice(0, 120));
  const prompt = `Mavzu: ${String(b.topic || '').slice(0, 200)}. Quyidagi ${caps.length} ta rasm uchun sodda, aniq, sxematik SVG chizma yarat. Har biri alohida <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">...</svg> bo'lsin: oq fon, qalin chiziqlar, aniq ranglar, qisqa yozuvlar faqat lotin alifbosida o'zbekcha. Skript, tashqi havola va raster rasm ishlatma. Faqat SVG kodlarini ketma-ket yoz, tushuntirish yozma.\n` + caps.map((c, i) => `${i + 1}) ${c}`).join('\n');
  try {
    const text = await aiText(prompt, 6000);
    return json({ svgs: text.match(/<svg[\s\S]*?<\/svg>/g) || [] });
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
};
export const config = { path: '/api/images' };
