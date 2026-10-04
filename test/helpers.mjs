import { normalizeConfig } from '../scripts/lib/config.mjs';
import { parsePost } from '../scripts/lib/posts.mjs';

export const config = normalizeConfig({
  timezone: 'America/Chicago',
  site_url: 'https://example.org/smp/',
  buffer: { channels: { facebook: 'fb-1', instagram: 'ig-1' }, schedule_window_days: 14 },
});

export function makePost(front, body = 'Blessed feast!', file = '2026-10-11-st-thomas.md') {
  const lines = Object.entries(front).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return parsePost(`---\n${lines.join('\n')}\n---\n\n${body}\n`, file);
}
