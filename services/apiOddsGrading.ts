/**
 * Pure grading for bets placed against Odds API events, using the /scores payload.
 * See: https://the-odds-api.com/liveapi/guides/v4/#get-scores
 */

import type { MarketOption } from '@/models';
import type { OddsApiScoreEvent } from './oddsApiScores';

export type ApiGrade = 'WON' | 'LOST' | 'PUSH' | 'VOID';

function parseScores(event: OddsApiScoreEvent): { home: number; away: number } | null {
  const homeName = event.home_team?.trim() ?? '';
  const awayName = event.away_team?.trim() ?? '';
  if (!homeName || !awayName || !event.scores?.length) return null;
  let home = 0;
  let away = 0;
  for (const row of event.scores) {
    if (row.name === homeName) home = parseInt(row.score, 10) || 0;
    else if (row.name === awayName) away = parseInt(row.score, 10) || 0;
  }
  return { home, away };
}

function inferMarketKey(
  label: string,
  event: OddsApiScoreEvent,
): 'h2h' | 'spreads' | 'totals' | 'outrights' {
  const t = label.trim();
  if (/^(over|under)\s+/i.test(t)) return 'totals';
  const home = event.home_team?.trim() ?? '';
  const away = event.away_team?.trim() ?? '';
  if (t === home || t === away) return 'h2h';
  const drawish = /^(draw|tie)$/i.test(t);
  if (drawish) return 'h2h';
  return 'spreads';
}

/**
 * @returns null if the game is not ready to grade (not completed or missing scores).
 */
export function gradeOddsApiSelection(
  pick: { label: string; marketKey?: MarketOption['marketKey'] },
  event: OddsApiScoreEvent,
): ApiGrade | null {
  if (!event.completed) return null;
  const parsed = parseScores(event);
  if (!parsed) return null;

  const { home: homeScore, away: awayScore } = parsed;
  const home = event.home_team?.trim() ?? '';
  const away = event.away_team?.trim() ?? '';
  const label = pick.label.trim();
  const mk = pick.marketKey ?? inferMarketKey(label, event);

  if (mk === 'h2h' || mk === 'outrights') {
    if (/^(draw|tie)$/i.test(label)) {
      if (homeScore === awayScore) return 'WON';
      return 'LOST';
    }
    if (label === home) {
      if (homeScore === awayScore) return 'PUSH';
      return homeScore > awayScore ? 'WON' : 'LOST';
    }
    if (label === away) {
      if (homeScore === awayScore) return 'PUSH';
      return awayScore > homeScore ? 'WON' : 'LOST';
    }
    return 'VOID';
  }

  if (mk === 'totals') {
    const m = label.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)\s*$/i);
    if (!m) return 'VOID';
    const line = parseFloat(m[2]);
    if (!Number.isFinite(line)) return 'VOID';
    const total = homeScore + awayScore;
    const side = m[1].toLowerCase();
    if (side === 'over') {
      if (total === line) return 'PUSH';
      return total > line ? 'WON' : 'LOST';
    }
    if (total === line) return 'PUSH';
    return total < line ? 'WON' : 'LOST';
  }

  if (mk === 'spreads') {
    const sides = [
      { which: 'home' as const, name: home },
      { which: 'away' as const, name: away },
    ].sort((a, b) => b.name.length - a.name.length);

    let picked: 'home' | 'away' | null = null;
    let spreadStr: string | null = null;
    for (const { which, name } of sides) {
      if (!name) continue;
      if (label.startsWith(name)) {
        const rest = label.slice(name.length).trim();
        if (/^[+-]?\d+(?:\.\d+)?$/.test(rest)) {
          picked = which;
          spreadStr = rest;
          break;
        }
      }
    }
    if (!picked || spreadStr == null) {
      const rm = label.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)\s*$/);
      if (!rm) return 'VOID';
      const teamName = rm[1].trim();
      if (teamName === home) picked = 'home';
      else if (teamName === away) picked = 'away';
      else return 'VOID';
      spreadStr = rm[2];
    }

    const spread = parseFloat(spreadStr);
    if (!Number.isFinite(spread)) return 'VOID';

    const pickedMargin =
      picked === 'home' ? homeScore - awayScore : awayScore - homeScore;
    const adjusted = pickedMargin + spread;
    if (adjusted > 0) return 'WON';
    if (adjusted < 0) return 'LOST';
    return 'PUSH';
  }

  return 'VOID';
}
