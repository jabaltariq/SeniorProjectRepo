/**
 * Realistic mock NFL lines: half-point spreads, standard negative juice on
 * spread/total sides (no duplicate +108 / +108 mirrors), ML correlated with favorite.
 */

import { americanToDecimal } from './oddsAmericanFormat';

/** Typical main-market juice (both sides usually negative near -110). */
const SPREAD_OR_TOTAL_JUICE = [-125, -122, -120, -118, -115, -112, -110, -108, -105] as const;

function pickDistinctSpreadTotalJuices(): [number, number] {
  const pick = () =>
    SPREAD_OR_TOTAL_JUICE[Math.floor(Math.random() * SPREAD_OR_TOTAL_JUICE.length)];
  let a = pick();
  let b = pick();
  for (let i = 0; i < 24 && a === b; i++) b = pick();
  return [americanToDecimal(a), americanToDecimal(b)];
}

function shufflePair(pair: [number, number]): [number, number] {
  return Math.random() < 0.5 ? pair : [pair[1], pair[0]];
}

/** 0.5 through 15.5 in 0.5 steps (e.g. -7.5 favorite). */
export function randomSpreadMagnitudeHalf(): number {
  const k = Math.floor(Math.random() * 31) + 1;
  return k * 0.5;
}

/** Total line 39.5–53.5 in half-point steps. */
export function randomTotalLineHalf(): number {
  const low = 79;
  const high = 107;
  const idx = Math.floor(Math.random() * (high - low + 1)) + low;
  return idx * 0.5;
}

/** Favorite = shorter ML; underdog = plus-money. */
export function mlDecimalsForFavorite(favoriteIsAway: boolean): { away: number; home: number } {
  const favAm = -Math.round(135 + Math.random() * 105);
  const dogAm = Math.round(125 + Math.random() * 105);
  const fav = americanToDecimal(favAm);
  const dog = americanToDecimal(dogAm);
  if (favoriteIsAway) return { away: fav, home: dog };
  return { away: dog, home: fav };
}

export function spreadSideDecimals(): { away: number; home: number } {
  const [d1, d2] = shufflePair(pickDistinctSpreadTotalJuices());
  return { away: d1, home: d2 };
}

export function totalSideDecimals(): { over: number; under: number } {
  const [d1, d2] = shufflePair(pickDistinctSpreadTotalJuices());
  return { over: d1, under: d2 };
}
