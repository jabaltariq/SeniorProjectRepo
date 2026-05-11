import type { Market } from '@/models';

/** Text used for substring search (teams often appear only on spread/h2h option labels). */
export function marketSearchHaystack(m: Market): string {
  const parts = [
    m.title,
    m.subtitle,
    m.category,
    m.sport_key ?? '',
    ...m.options.map((o) => o.label),
  ];
  return parts.join(' ').toLowerCase().replace(/@/g, ' ');
}

export function queryMatchesHaystack(haystack: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

export function filterMarketsBySearchQuery(markets: readonly Market[], rawQuery: string): Market[] {
  const q = rawQuery.trim();
  if (!q) return [...markets];
  return markets.filter((m) => queryMatchesHaystack(marketSearchHaystack(m), rawQuery));
}
