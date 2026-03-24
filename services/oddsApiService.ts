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

/** Odds API sport keys per dashboard tab (ALL uses upcoming only). */
const SPORT_API_KEYS: Record<string, string[]> = {
  Football: ['americanfootball_nfl', 'americanfootball_ncaaf'],
  Basketball: ['basketball_nba', 'basketball_ncaab'],
  Baseball: ['baseball_mlb'],
  Hockey: ['icehockey_nhl'],
  Soccer: ['soccer_england_league1', 'soccer_uefa_champions_league'],
};

/** Space out Odds API calls — parallel bursts still hit 429 on free / low tiers. */
const MS_BETWEEN_ODDS_REQUESTS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Match dashboard columns: moneyline, spread, total (Odds API usage scales with markets requested). */
const ODDS_MARKETS_PARAM = 'markets=h2h,spreads,totals&oddsFormat=decimal';

async function fetchOddsForSport(sportKey: string, region: string): Promise<OddsApiEvent[]> {
  const url = sportKey === 'upcoming'
    ? `${API_BASE}/odds?regions=${region}&${ODDS_MARKETS_PARAM}`
    : `${API_BASE}/odds/${sportKey}?regions=${region}&${ODDS_MARKETS_PARAM}`;

  const load = async (): Promise<Response> => fetch(url);
  let res = await load();
  if (res.status === 429) {
    await delay(2500);
    res = await load();
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload &&
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as { message: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload ?? {}).slice(0, 200);
    throw new Error(`Odds API ${res.status}: ${msg}`);
  }
  if (!Array.isArray(payload)) {
    throw new Error('Odds API returned an invalid response (expected a JSON array). Is ODDS_API_KEY set?');
  }
  return payload;
}

/**
 * Fetches odds only for the selected dashboard tab (ALL = single upcoming request).
 */
export async function fetchMarketsForSportTab(sportTab: string, region = 'us'): Promise<Market[]> {
  const seen = new Set<string>();
  const markets: Market[] = [];

  if (sportTab === 'ALL') {
    const data = await fetchOddsForSport('upcoming', region);
    for (const event of data) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const market = transformEventToMarket(event);
      if (market) markets.push(market);
    }
    return markets;
  }

  const keys = SPORT_API_KEYS[sportTab];
  if (!keys?.length) return [];

  let lastError: Error | null = null;
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) await delay(MS_BETWEEN_ODDS_REQUESTS);
    try {
      const data = await fetchOddsForSport(keys[i], region);
      for (const event of data) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        const market = transformEventToMarket(event);
        if (market) markets.push(market);
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (markets.length === 0 && lastError) {
    throw lastError;
  }

  return markets;
}

export async function fetchUpcomingOdds(region = 'us'): Promise<Market[]> {
  return fetchMarketsForSportTab('ALL', region);
}

