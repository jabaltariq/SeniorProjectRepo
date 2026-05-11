import { MarketType, type Market } from '@/models';
import type { MockNflGameState } from '@/models';

export function normalizeMockSpreadLine(line: number) {
  return line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);
}

/** Builds the same synthetic market object the Markets NFL mock board uses. */
export function buildMockNflMarketFromGameState(game: MockNflGameState): Market {
  return {
    id: `mock-${game.id}`,
    sport_key: 'football_nfl_mock',
    title: `${game.awayTeam} @ ${game.homeTeam}`,
    subtitle: 'NFL (sim)',
    category: 'Football',
    type: MarketType.SPORTS,
    startTime: new Date(game.updatedAtMs).toISOString(),
    status: game.status === 'FINAL' ? 'CLOSED' : 'UPCOMING',
    options: [
      {
        id: `${game.id}-spread-away`,
        label: `${game.awayTeam} ${normalizeMockSpreadLine(game.spreadLine)}`,
        odds: game.spreadAwayOdds ?? game.awayOdds,
        marketKey: 'spreads',
      },
      {
        id: `${game.id}-spread-home`,
        label: `${game.homeTeam} ${normalizeMockSpreadLine(-game.spreadLine)}`,
        odds: game.spreadHomeOdds ?? game.homeOdds,
        marketKey: 'spreads',
      },
      {
        id: `${game.id}-total-over`,
        label: `Over ${game.totalLine.toFixed(1)}`,
        odds: game.totalOverOdds,
        marketKey: 'totals',
      },
      {
        id: `${game.id}-total-under`,
        label: `Under ${game.totalLine.toFixed(1)}`,
        odds: game.totalUnderOdds,
        marketKey: 'totals',
      },
      { id: `${game.id}-ml-away`, label: game.awayTeam, odds: game.awayOdds, marketKey: 'h2h' },
      { id: `${game.id}-ml-home`, label: game.homeTeam, odds: game.homeOdds, marketKey: 'h2h' },
    ],
  };
}
