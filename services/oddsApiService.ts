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

  const title = event.home_team && event.away_team
    ? `${event.away_team} @ ${event.home_team}`
    : event.home_team || event.away_team || 'Event';
  const subtitle = event.sport_title || sportKeyToLeague(event.sport_key);

  const options: MarketOption[] = h2hMarket.outcomes.map((outcome, i) => {
    let odds = outcome.price;
    if (odds > 100 || odds < -100) {
      odds = americanToDecimal(odds);
    }
    return {
      id: `o-${event.id}-${i}`,
      label: outcome.name,
      odds: Math.round(odds * 100) / 100,
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

async function fetchOddsForSport(sportKey: string, region: string): Promise<OddsApiEvent[]> {
  const url = sportKey === 'upcoming'
    ? `${API_BASE}/odds?regions=${region}&markets=h2h&oddsFormat=decimal`
    : `${API_BASE}/odds/${sportKey}?regions=${region}&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchUpcomingOdds(region = 'us'): Promise<Market[]> {
  const results = await Promise.allSettled(
    POPULAR_SPORTS.map((sport) => fetchOddsForSport(sport, region))
  );
  const seen = new Set<string>();
  const markets: Market[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const data: OddsApiEvent[] = result.value;
    for (const event of data) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const market = transformEventToMarket(event);
      if (market) markets.push(market);
    }
  }
  return markets;
}

