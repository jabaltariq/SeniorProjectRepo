/**
 * Odds API key from .env then .env.local (later wins). If the key appears in either
 * file, that value is used — not process.env — so a stale ODDS_API_KEY in the OS or
 * shell cannot override what you put in the repo files.
 */
import fs from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

export function loadOddsApiKey(repoRoot) {
  const merged = {};
  for (const name of ['.env', '.env.local']) {
    const p = join(repoRoot, name);
    if (fs.existsSync(p)) {
      Object.assign(merged, dotenv.parse(fs.readFileSync(p, 'utf8')));
    }
  }
  const raw = Object.hasOwn(merged, 'ODDS_API_KEY')
    ? merged.ODDS_API_KEY
    : (process.env.ODDS_API_KEY || '');
  return typeof raw === 'string' ? raw.trim() : '';
}
