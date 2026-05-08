/**
 * Express backend for BetHub
 * Handles auth and proxies Odds API requests (keeps API key server-side)
 *
 * TODO(settlement): The original `settleOpenBets` cron was wired up here but
 * its implementation file (`server/settlement.js`) was never committed to any
 * branch — git log -S 'settleOpenBets' shows the import landed in 55b3095
 * without the file. As a result `npm run server` has been crash-on-boot since
 * that commit. Today only the in-app `settleUserMockNflGameBets` path runs
 * (called from the frontend when a mock NFL game finalizes); API-game
 * settlement does not run anywhere. When somebody resurrects automatic API
 * settlement, plug it back in here:
 *   1. create `server/settlement.js` exporting `settleOpenBets()`
 *   2. uncomment the import + cron block below
 *   3. swap the 503 stub on POST /api/settle-bets for the real call
 *      The shared building blocks (`getPendingBets`, `settleBet`,
 *      `recordParlayLegResult`, `settleParlayBetIfReady`,
 *      `getAcceptedHeadToHead`, `settleHeadToHead`) already exist in
 *      services/dbOps.ts.
 *   - 5.8.2026 Aidan O'Halloran
 */
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadOddsApiKey } from '../lib/loadOddsApiKey.js';
// import { settleOpenBets } from './settlement.js';  // disabled — file was never committed; see TODO above

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, '..');
dotenv.config({ path: join(repoRoot, '.env') });
dotenv.config({ path: join(repoRoot, '.env.local') });

const app        = express();
const PORT       = process.env.PORT || 3001;
const ODDS_API_KEY = loadOddsApiKey(repoRoot);

// In-memory user store (replace with a database in production)
const users = new Map();

// Middleware
app.use(express.json());

// ─── Settlement cron (disabled) ──────────────────────────────────────────────
// The cron previously called `settleOpenBets()` from `server/settlement.js`,
// but that file was never committed (see TODO at top of this file). The block
// below is preserved verbatim so it can be re-enabled in one move once a real
// settlement implementation exists.
// const SETTLEMENT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
//
// async function runSettlement() {
//   try {
//     console.log('[settlement] Running job…');
//     const result = await settleOpenBets();
//     console.log('[settlement] Done:', JSON.stringify(result));
//   } catch (err) {
//     // Never crash the server — just log
//     console.error('[settlement] Error:', err.message ?? err);
//   }
// }
//
// setTimeout(() => {
//   void runSettlement();                                   // run once on boot
//   setInterval(() => void runSettlement(), SETTLEMENT_INTERVAL_MS);
// }, 30_000);
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BetHub API is running' });
});

// Manual settlement trigger — currently a 503 stub because `settleOpenBets`
// was never implemented (see TODO at top of file). Route is kept registered so
// callers get a clear "not implemented" response instead of a 404.
app.post('/api/settle-bets', (_req, res) => {
  res.status(503).json({
    error: 'Settlement not implemented yet',
    detail:
      'server/settlement.js was never committed. See TODO at the top of server/index.js.',
  });
});

// --- Auth routes ---
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  const trimmed = String(email || '').trim().toLowerCase();

  if (!trimmed || !password)
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  if (users.has(trimmed))
    return res.status(400).json({ success: false, error: 'An account with this email already exists' });

  users.set(trimmed, { email: trimmed, password });
  res.json({ success: true, email: trimmed });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const trimmed = String(email || '').trim().toLowerCase();

  const user = users.get(trimmed);
  if (!user || user.password !== password)
    return res.status(401).json({ success: false, error: 'Invalid email or password' });

  res.json({ success: true, email: trimmed });
});

// --- Odds API proxy (keeps API key server-side) ---
async function proxyOddsApiJson(res, sportKey, query) {
  if (!ODDS_API_KEY) {
    return res.status(503).json({
      message: 'Server has no ODDS_API_KEY. Set ODDS_API_KEY in .env or .env.local and restart the API.',
    });
  }
  const queryStr = new URLSearchParams(query).toString();
  const sep = queryStr ? '&' : '';
  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds?${queryStr}${sep}apiKey=${encodeURIComponent(ODDS_API_KEY)}`;
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  return res.status(response.status).json(data);
}

app.get('/api/odds', async (req, res) => {
  try { await proxyOddsApiJson(res, 'upcoming', req.query); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/odds/:sportKey', async (req, res) => {
  try { await proxyOddsApiJson(res, req.params.sportKey, req.query); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/sports', async (req, res) => {
  try {
    if (!ODDS_API_KEY) {
      return res.status(503).json({
        message: 'Server has no ODDS_API_KEY. Set ODDS_API_KEY in .env or .env.local and restart the API.',
      });
    }
    const queryStr = new URLSearchParams(req.query).toString();
    const sep = queryStr ? '&' : '';
    const url = `https://api.the-odds-api.com/v4/sports?${queryStr}${sep}apiKey=${encodeURIComponent(ODDS_API_KEY)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve built React app at /bethub (matches Vite base)
const distPath = join(__dirname, '..', 'dist');
app.use('/bethub', express.static(distPath));
app.use('/bethub', (req, res) => res.sendFile(join(distPath, 'index.html')));
app.get('/', (req, res) => res.redirect('/bethub/'));

app.listen(PORT, () => {
  console.log(`BetHub API running on http://localhost:${PORT}`);
});