/**
 * Run with: npm run test:parlay
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { gradeOddsApiSelection } from '../apiOddsGrading.ts';
import type { OddsApiScoreEvent } from '../oddsApiScores.ts';

const nbaFinal: OddsApiScoreEvent = {
  id: 'evt1',
  sport_key: 'basketball_nba',
  completed: true,
  home_team: 'Sacramento Kings',
  away_team: 'Oklahoma City Thunder',
  scores: [
    { name: 'Sacramento Kings', score: '113' },
    { name: 'Oklahoma City Thunder', score: '103' },
  ],
};

test('h2h home wins', () => {
  const g = gradeOddsApiSelection(
    { label: 'Sacramento Kings', marketKey: 'h2h' },
    nbaFinal,
  );
  assert.equal(g, 'WON');
});

test('h2h away loses', () => {
  const g = gradeOddsApiSelection(
    { label: 'Oklahoma City Thunder', marketKey: 'h2h' },
    nbaFinal,
  );
  assert.equal(g, 'LOST');
});

test('totals over wins', () => {
  const g = gradeOddsApiSelection({ label: 'Over 210.5', marketKey: 'totals' }, nbaFinal);
  assert.equal(g, 'WON');
});

test('totals under loses', () => {
  const g = gradeOddsApiSelection({ label: 'Under 210.5', marketKey: 'totals' }, nbaFinal);
  assert.equal(g, 'LOST');
});

test('spread away +7 loses when down 10', () => {
  // home 113 away 103 -> margin away = -10, +7 => -3 LOST
  const g = gradeOddsApiSelection(
    { label: 'Oklahoma City Thunder +7', marketKey: 'spreads' },
    nbaFinal,
  );
  assert.equal(g, 'LOST');
});

test('spread away +7 wins when losing by 6', () => {
  const e: OddsApiScoreEvent = {
    ...nbaFinal,
    scores: [
      { name: 'Sacramento Kings', score: '100' },
      { name: 'Oklahoma City Thunder', score: '94' },
    ],
  };
  const g = gradeOddsApiSelection(
    { label: 'Oklahoma City Thunder +7', marketKey: 'spreads' },
    e,
  );
  assert.equal(g, 'WON');
});

test('incomplete event -> null', () => {
  const g = gradeOddsApiSelection(
    { label: 'Sacramento Kings', marketKey: 'h2h' },
    { ...nbaFinal, completed: false },
  );
  assert.equal(g, null);
});
