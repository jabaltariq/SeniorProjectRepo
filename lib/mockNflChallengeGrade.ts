import type { MockNflGameState } from '@/models';

function normalizeSpreadLine(line: number) {
  return line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);
}

/** Grades a pick label after the mock game is FINAL (same rules as bet settlement). */
export function gradeMockNflPickAfterFinal(
  game: MockNflGameState,
  optionLabel: string,
): 'WON' | 'LOST' | 'PUSH' | 'VOID' | null {
  if (game.status !== 'FINAL' || game.awayScore == null || game.homeScore == null) return null;

  const awayTeam = game.awayTeam;
  const homeTeam = game.homeTeam;
  const awaySpreadLabel = `${awayTeam} ${normalizeSpreadLine(game.spreadLine)}`;
  const homeSpread = -game.spreadLine;
  const homeSpreadLabel = `${homeTeam} ${normalizeSpreadLine(homeSpread)}`;
  const overLabel = `Over ${game.totalLine.toFixed(1)}`;
  const underLabel = `Under ${game.totalLine.toFixed(1)}`;
  const margin = game.awayScore - game.homeScore;
  const totalScore = game.awayScore + game.homeScore;
  const selected = optionLabel.trim();

  if (selected === awayTeam) {
    if (game.awayScore === game.homeScore) return 'PUSH';
    return game.awayScore > game.homeScore ? 'WON' : 'LOST';
  }
  if (selected === homeTeam) {
    if (game.awayScore === game.homeScore) return 'PUSH';
    return game.homeScore > game.awayScore ? 'WON' : 'LOST';
  }
  if (selected === awaySpreadLabel) {
    const spreadResult = margin + game.spreadLine;
    if (spreadResult === 0) return 'PUSH';
    return spreadResult > 0 ? 'WON' : 'LOST';
  }
  if (selected === homeSpreadLabel) {
    const spreadResult = -margin - game.spreadLine;
    if (spreadResult === 0) return 'PUSH';
    return spreadResult > 0 ? 'WON' : 'LOST';
  }
  if (selected === overLabel) {
    if (totalScore === game.totalLine) return 'PUSH';
    return totalScore > game.totalLine ? 'WON' : 'LOST';
  }
  if (selected === underLabel) {
    if (totalScore === game.totalLine) return 'PUSH';
    return totalScore < game.totalLine ? 'WON' : 'LOST';
  }
  return 'VOID';
}
