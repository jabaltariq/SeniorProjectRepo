import { Market, MarketOption, MarketType } from '../models';

const API_BASE = '/api';

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers: OddsApiBookmaker[];
}

function getMockSteelersRavensMarket(): Market {
  return {
    id: 'mock-nfl-steelers-ravens',
    title: 'Pittsburgh Steelers @ Baltimore Ravens (MOCK)',
    subtitle: 'NFL (MOCK)',
    category: 'Football',
    type: MarketType.SPORTS,
    status: 'UPCOMING',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: 'mock-h2h-steelers', label: 'Pittsburgh Steelers', odds: 2.2, marketKey: 'h2h' },
      { id: 'mock-h2h-ravens', label: 'Baltimore Ravens', odds: 1.72, marketKey: 'h2h' },
      { id: 'mock-spread-steelers', label: 'Pittsburgh Steelers +3.5', odds: 1.91, marketKey: 'spreads' },
      { id: 'mock-spread-ravens', label: 'Baltimore Ravens -3.5', odds: 1.91, marketKey: 'spreads' },
      { id: 'mock-total-over', label: 'Over 45.5', odds: 1.9, marketKey: 'totals' },
      { id: 'mock-total-under', label: 'Under 45.5', odds: 1.9, marketKey: 'totals' },
    ],
  };
}

function americanToDecimal(american: number): number {
  if (american >= 100) {
    return 1 + american / 100;
  }
  return 1 + 100 / Math.abs(american);
}

function sportKeyToSport(sportKey: string): string {
  const sport = sportKey.split('_')[0] ?? '';
  const sportMap: Record<string, string> = {
    soccer: 'Soccer',
    basketball: 'Basketball',
    baseball: 'Baseball',
    americanfootball: 'Football',
    icehockey: 'Hockey',
    mma: 'MMA',
    tennis: 'Tennis',
    cricket: 'Cricket',
    rugbyleague: 'Rugby League',
    rugbyunion: 'Rugby Union',
    aussierules: 'AFL',
    golf: 'Golf',
    boxing: 'Boxing',
    cycling: 'Cycling',
    darts: 'Darts',
    esports: 'Esports',
  };
  return sportMap[sport] ?? sport.charAt(0).toUpperCase() + sport.slice(1);
}

function sportKeyToLeague(sportKey: string): string {
  const key = sportKey.toLowerCase();
  const leagueMap: Record<string, string> = {
    soccer_england_league1: 'League 1',
    soccer_england_league2: 'League 2',
    soccer_england_championship: 'Championship',
    soccer_uefa_european_championship: 'UEFA Champions League',
    soccer_uefa_champions_league: 'UEFA Champions League',
    basketball_nba: 'NBA',
    basketball_ncaab: 'NCAA',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  };
  if (leagueMap[key]) return leagueMap[key];
  const parts = sportKey.split('_');
  if (parts[0] === 'soccer') {
    const last = parts[parts.length - 1] ?? '';
    const m = last.match(/^([a-z]+)(\d+)$/i);
    return m ? `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} ${m[2]}` : last.charAt(0).toUpperCase() + last.slice(1);
  }
  if (parts[0] === 'basketball') return parts.includes('nba') ? 'NBA' : parts.includes('ncaab') ? 'NCAA' : 'Basketball';
  if (parts[0] === 'americanfootball') return parts.includes('nfl') ? 'NFL' : parts.includes('ncaaf') ? 'NCAAF' : 'Football';
  if (parts[0] === 'baseball') return parts.includes('mlb') ? 'MLB' : parts.includes('ncaab') ? 'NCAA Baseball' : 'Baseball';
  if (parts[0] === 'icehockey') return parts.includes('nhl') ? 'NHL' : 'Hockey';
  return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || sportKey;
}

function transformEventToMarket(event: OddsApiEvent): Market | null {
  const bookmaker = event.bookmakers?.[0];
  if (!bookmaker) return null;

  const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h' || m.key === 'outrights');
  if (!h2hMarket?.outcomes?.length) return null;
  const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
  const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');

  const title = event.home_team && event.away_team
    ? `${event.away_team} @ ${event.home_team}`
    : event.home_team || event.away_team || 'Event';
  const subtitle = event.sport_title || sportKeyToLeague(event.sport_key);

  const normalizeOdds = (price: number) => {
    if (price > 100 || price < -100) {
      return americanToDecimal(price);
    }
    return price;
  };

  const h2hOptions: MarketOption[] = h2hMarket.outcomes.map((outcome, i) => {
    const odds = normalizeOdds(outcome.price);
    return {
      id: `o-${event.id}-h2h-${i}`,
      label: outcome.name,
      odds: Math.round(odds * 100) / 100,
      marketKey: h2hMarket.key === 'outrights' ? 'outrights' : 'h2h',
    };
  });

  const spreadOptions: MarketOption[] = (spreadsMarket?.outcomes ?? []).map((outcome, i) => {
    const odds = normalizeOdds(outcome.price);
    const point = typeof outcome.point === 'number' ? outcome.point : 0;
    const spreadLabel = point > 0 ? `+${point}` : `${point}`;
    return {
      id: `o-${event.id}-spread-${i}`,
      label: `${outcome.name} ${spreadLabel}`,
      odds: Math.round(odds * 100) / 100,
      marketKey: 'spreads',
    };
  });

  const totalOptions: MarketOption[] = (totalsMarket?.outcomes ?? []).map((outcome, i) => {
    const odds = normalizeOdds(outcome.price);
    const point = typeof outcome.point === 'number' ? outcome.point : 0;
    return {
      id: `o-${event.id}-total-${i}`,
      label: `${outcome.name} ${point}`,
      odds: Math.round(odds * 100) / 100,
      marketKey: 'totals',
    };
  });

  const options: MarketOption[] = [...h2hOptions, ...spreadOptions, ...totalOptions].map((option, i) => {
    return {
      ...option,
      id: option.id || `o-${event.id}-${i}`,
    };
  });

  const commenceTime = new Date(event.commence_time);
  const now = new Date();
  const status = commenceTime > now ? 'UPCOMING' : 'LIVE';

  return {
    id: event.id,
    title,
    subtitle,
    category: sportKeyToSport(event.sport_key),
    type: MarketType.SPORTS,
    status,
    startTime: event.commence_time,
    options,
  };
}

const POPULAR_SPORTS = [
  'upcoming',
  'basketball_nba',
  'baseball_mlb',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer_england_league1',
  'soccer_uefa_champions_league',
];

/** Space out Odds API calls — parallel requests hit 429 (Too Many Requests) on free / low tiers. */
const MS_BETWEEN_ODDS_REQUESTS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOddsForSport(sportKey: string, region: string): Promise<OddsApiEvent[]> {
  const url = sportKey === 'upcoming'
    ? `${API_BASE}/odds?regions=${region}&markets=h2h,spreads,totals&oddsFormat=decimal`
    : `${API_BASE}/odds/${sportKey}?regions=${region}&markets=h2h,spreads,totals&oddsFormat=decimal`;

  const load = async (): Promise<Response> => fetch(url);
  let res = await load();
  if (res.status === 429) {
    await delay(2500);
    res = await load();
  }
  if (!res.ok) return [];
  return res.json();
}

let upcomingOddsInFlight: Promise<Market[]> | null = null;

export async function fetchUpcomingOdds(region = 'us'): Promise<Market[]> {
  if (upcomingOddsInFlight) return upcomingOddsInFlight;

  upcomingOddsInFlight = (async () => {
    const seen = new Set<string>();
    const markets: Market[] = [];

    for (let i = 0; i < POPULAR_SPORTS.length; i++) {
      if (i > 0) await delay(MS_BETWEEN_ODDS_REQUESTS);
      try {
        const data = await fetchOddsForSport(POPULAR_SPORTS[i], region);
        for (const event of data) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          const market = transformEventToMarket(event);
          if (market) markets.push(market);
        }
      } catch {
        /* skip failed sport batch */
      }
    }

    return [getMockSteelersRavensMarket(), ...markets];
  })();

  try {
    return await upcomingOddsInFlight;
  } finally {
    upcomingOddsInFlight = null;
  }
}

