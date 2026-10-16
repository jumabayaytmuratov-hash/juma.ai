import { getCfg, getLic, leftOf, premium, okDev, json } from '../lib/common.mjs';
export default async (req) => {
  const d = new URL(req.url).searchParams.get('d');
  if (!okDev(d)) return json({ error: 'bad' }, 400);
  const [c, l] = await Promise.all([getCfg(), getLic(d)]);
  return json({ premium: premium(l), until: l.until, left: leftOf(l, c) });
};
export const config = { path: '/api/me' };
