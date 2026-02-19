/**
 * Express backend for BetHub
 * Handles auth and proxies Odds API requests (keeps API key server-side)
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

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
async function proxyOddsApi(path, query) {
  const queryStr = new URLSearchParams(query).toString();
  const url = `https://api.the-odds-api.com${path}?${queryStr}&apiKey=${encodeURIComponent(ODDS_API_KEY)}`;
  const response = await fetch(url);
  return response.json();
}

app.all(/^\/api\/odds(\/.*)?/, async (req, res) => {
  try {
    const sport = (req.params[0] || '').replace(/^\//, '') || 'upcoming';
    const data = await proxyOddsApi(`/v4/sports/${sport}/odds`, req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/sports*', async (req, res) => {
  try {
    const data = await proxyOddsApi('/v4/sports', req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built React app in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(distPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`BetHub API running on http://localhost:${PORT}`);
});
