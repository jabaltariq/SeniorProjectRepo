/**
 * Fetches completed/live scores from The Odds API via the same /api proxy as odds.
 * Event `id` matches the event id used on markets and parlay legs (`marketId`).
 */

const API_BASE = '/api';

export type OddsApiScoreRow = { name: string; score: string };

export type OddsApiScoreEvent = {
  id: string;
  sport_key: string;
  completed: boolean;
  home_team?: string;
  away_team?: string;
  scores: OddsApiScoreRow[] | null;
};

export async function fetchOddsApiScores(
  sportKey: string,
  daysFrom: 1 | 2 | 3 = 3,
): Promise<OddsApiScoreEvent[]> {
  const q = new URLSearchParams({ daysFrom: String(daysFrom) });
  const res = await fetch(`${API_BASE}/scores/${encodeURIComponent(sportKey)}?${q}`);
  if (!res.ok) {
    throw new Error(`scores ${sportKey}: ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as OddsApiScoreEvent[];
}
