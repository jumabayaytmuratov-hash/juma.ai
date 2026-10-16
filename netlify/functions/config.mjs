import { getCfg, json } from '../lib/common.mjs';
export default async () => {
  const c = await getCfg();
  return json({ lesson: c.lesson, year: c.year, free: c.free, card: c.card, tg: c.tg });
};
export const config = { path: '/api/config' };
