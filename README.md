<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BetHub - Simulated Betting

A simulated sports betting app with real odds from [The Odds API](https://the-odds-api.com/).

## Architecture (MVVM)

The project follows **Model-View-ViewModel** (MVVM) architecture:

```
├── models/           # Domain models & constants
│   ├── index.ts      # Types (Market, Bet, User, etc.)
│   └── constants.ts  # App constants, mock data
├── views/            # Presentation layer (dumb components)
│   ├── LoginView.tsx
│   ├── SignUpView.tsx
│   └── DashboardView.tsx
├── viewModels/       # Presentation logic (custom hooks)
│   ├── useAuthViewModel.ts
│   ├── useAuthFormsViewModel.ts
│   ├── useBettingViewModel.ts
│   ├── useMarketsViewModel.ts
│   └── useDashboardViewModel.ts
├── services/         # Data access & API
│   ├── authService.ts
│   └── oddsApiService.ts
└── components/       # Reusable UI components
```

- **Models**: Data structures and domain types
- **Views**: Pure UI components that receive props and render
- **ViewModels**: Hooks that hold state, business logic, and expose data/commands to Views
- **Services**: API calls and localStorage persistence

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Odds API key:
   - Copy `.env.example` to `.env.local`
   - Add your [Odds API key](https://the-odds-api.com/) to `ODDS_API_KEY`
3. Run the app:
   ```bash
   npm run dev
   ```

Open http://localhost:3000

## Express Backend (Optional)

The project includes an optional Express.js backend for server-side auth and API proxying.

**Development (Vite + Express):**
```bash
npm run dev:all
```
- Vite (React) runs on port 3000
- Express API runs on port 3001
- Auth uses Express; odds are proxied through Express (API key stays server-side)

**Express-only (production build):**
```bash
npm run build
npm run start
```
- Express serves the built React app and handles all `/api` routes
- Set `PORT` and `ODDS_API_KEY` in the environment
