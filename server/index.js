/**
 * Express backend for BetHub
 * Handles auth and proxies Odds API requests (keeps API key server-side)
 */
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadOddsApiKey } from '../lib/loadOddsApiKey.js';
import { settleOpenBets } from './settlement.js';   // ← NEW

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

// ─── Settlement cron ──────────────────────────────────────────────────────────
// Runs every 10 minutes while the server is alive.
// Uses setInterval instead of node-cron to avoid an extra dependency.
// First run is delayed 30 s after boot so Firebase Admin has time to init.
const SETTLEMENT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

// const SETTLEMENT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes


async function runSettlement() {
  try {
    console.log('[settlement] Running job…');
    const result = await settleOpenBets();
    console.log('[settlement] Done:', JSON.stringify(result));
  } catch (err) {
    // Never crash the server — just log
    console.error('[settlement] Error:', err.message ?? err);
  }
}

setTimeout(() => {
  void runSettlement();                                   // run once on boot
  setInterval(() => void runSettlement(), SETTLEMENT_INTERVAL_MS); // then every 10 min
}, 30_000);
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BetHub API is running' });
});

// Manual trigger (useful for testing without waiting 10 min)
// Hit: POST /api/settle-bets
// Optional header: Authorization: Bearer <SETTLEMENT_SECRET>
app.post('/api/settle-bets', async (req, res) => {
  const secret = process.env.SETTLEMENT_SECRET;
  if (secret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  try {
    const result = await settleOpenBets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message ?? String(err) });
  }
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