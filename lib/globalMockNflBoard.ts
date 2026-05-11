/**
 * Shared random NFL sim game rows (same schedule for every account).
 */

import { MOCK_NFL_TEAM_POOL } from '@/models/constants';
import type { MockNflGameState } from '@/models';
import {
  mlDecimalsForFavorite,
  randomSpreadMagnitudeHalf,
  randomTotalLineHalf,
  spreadSideDecimals,
  totalSideDecimals,
} from '@/lib/mockNflGameGenerator';

const pickRandom = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const randomWeek = () => Math.floor(randomBetween(1, 19));

export const MOCK_NFL_BOARD_TARGET_COUNT = 5;

export function createRandomMockNflGameState(idPrefix: string, previous?: MockNflGameState): MockNflGameState {
  const teamPool = MOCK_NFL_TEAM_POOL;
  const shouldFlip = Boolean(previous) && Math.random() < 0.5;
  const awayTeam = shouldFlip && previous ? previous.homeTeam : pickRandom(teamPool);
  let homeTeam = shouldFlip && previous ? previous.awayTeam : pickRandom(teamPool);
  let guard = 0;
  while (homeTeam === awayTeam && guard < 10) {
    homeTeam = pickRandom(teamPool);
    guard += 1;
  }

  const spreadMag = randomSpreadMagnitudeHalf();
  const awayFavored = Math.random() < 0.5;
  const spreadLine = awayFavored ? -spreadMag : spreadMag;
  const ml = mlDecimalsForFavorite(awayFavored);
  const sp = spreadSideDecimals();
  const tot = totalSideDecimals();
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    week: randomWeek(),
    awayTeam,
    homeTeam,
    awayOdds: ml.away,
    homeOdds: ml.home,
    spreadAwayOdds: sp.away,
    spreadHomeOdds: sp.home,
    totalOverOdds: tot.over,
    totalUnderOdds: tot.under,
    spreadLine,
    totalLine: randomTotalLineHalf(),
    status: 'UPCOMING',
    awayScore: null,
    homeScore: null,
    winner: null,
    updatedAtMs: Date.now(),
  };
}

/** Keeps FINAL rows, pads with new UPCOMING games until `count` total rows. */
export function ensureMockBoardUpToCount(existing: MockNflGameState[], count: number): MockNflGameState[] {
  const upcoming = existing.filter((g) => g.status !== 'FINAL');
  const seeded = [...upcoming];
  while (seeded.length < count) {
    seeded.push(createRandomMockNflGameState('mock-nfl', seeded[seeded.length - 1]));
  }
  return seeded.slice(0, count);
}
