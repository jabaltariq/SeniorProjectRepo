/**
 * Express backend for BetHub
 * Handles auth and proxies Odds API requests (keeps API key server-side)
 */
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadOddsApiKey } from '../lib/loadOddsApiKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
dotenv.config({ path: join(repoRoot, '.env') });
dotenv.config({ path: join(repoRoot, '.env.local') });

const app = express();
const PORT = process.env.PORT || 3001;
const ODDS_API_KEY = loadOddsApiKey(repoRoot);

// In-memory user store (replace with a database in production)
const users = new Map();

// Middleware
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BetHub API is running' });
});

// --- Auth routes ---
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  const trimmed = String(email || '').trim().toLowerCase();

  if (!trimmed || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  if (users.has(trimmed)) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists' });
  }

  users.set(trimmed, { email: trimmed, password });
  res.json({ success: true, email: trimmed });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const trimmed = String(email || '').trim().toLowerCase();

  const user = users.get(trimmed);
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

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
  try {
    await proxyOddsApiJson(res, 'upcoming', req.query);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/odds/:sportKey', async (req, res) => {
  try {
    await proxyOddsApiJson(res, req.params.sportKey, req.query);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
