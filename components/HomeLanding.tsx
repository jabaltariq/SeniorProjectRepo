import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Trophy, Users, History, Gift, LogOut } from 'lucide-react';

/** Served from `public/home/` (respects Vite `base`, e.g. /bethub/) */
const homeImg = (file: string) => `${import.meta.env.BASE_URL}home/${file}`;

type Panel = {
  title: string;
  description: string;
  image: string;
  actions: readonly {
    label: string;
    to?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }[];
};

const PANELS: readonly Panel[] = [
  {
    title: 'Live markets',
    description: 'Odds for the sports we carry. Fake balance, fake payouts, no deposits.',
    image: homeImg('live-markets-hub.png'),
    actions: [
      { label: 'Browse markets', to: '/bet' },
      { label: 'Search games', to: '/bet', icon: <Search size={16} strokeWidth={2.5} /> },
    ],
  },
  {
    title: 'Arena rankings',
    description: 'Sorted by net worth. Shifts when your settled bets change your total.',
    image: homeImg('arena-rankings.png'),
    actions: [
      { label: 'View leaderboard', to: '/leaderboard', icon: <Trophy size={16} strokeWidth={2.5} /> },
      { label: 'Full standings', to: '/leaderboard' },
    ],
  },
  {
    title: 'Squad & rivals',
    description: 'Friends list, challenges, and who is doing what lately.',
    image: homeImg('squad-rivals.png'),
    actions: [
      { label: 'Open friends', to: '/friends', icon: <Users size={16} strokeWidth={2.5} /> },
      { label: 'Social feed', to: '/friends' },
    ],
  },
  {
    title: 'History & rewards',
    description: 'Old slips, the daily bonus, and the usual profile toggles.',
    image: homeImg('history-rewards.png'),
    actions: [{ label: 'Bet history', to: '/history', icon: <History size={16} strokeWidth={2.5} /> }],
  },
];

const ghostBtn =
  'inline-flex items-center justify-center gap-2 w-full max-w-[220px] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white border border-white/55 bg-white/5 hover:bg-white/15 hover:border-white/80 transition-colors';

interface HomeLandingProps {
  dailyBonusAvailable: boolean;
  onDailyBonus: () => void;
  onLogout: () => void;
  isLightMode?: boolean;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  dailyBonusAvailable,
  onDailyBonus,
  onLogout,
  isLightMode = false,
}) => {
  const navigate = useNavigate();

  return (
    <div className="home-landing flex flex-col min-h-0 h-full w-full bg-transparent">
      <header className="home-landing-header shrink-0 w-full border-b border-white/10 bg-[#0c3044] text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 px-4 sm:px-6 lg:px-10 py-5 sm:py-6">
          <nav className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.12em]">
            <NavLink to="/bet" className="hover:text-amber-200/90 transition-colors">
              Live markets
            </NavLink>
            <NavLink to="/leaderboard" className="hover:text-amber-200/90 transition-colors">
              Leaderboard
            </NavLink>
            <NavLink to="/friends" className="hover:text-amber-200/90 transition-colors">
              Social
            </NavLink>
          </nav>
          <nav className="flex flex-wrap items-center justify-center lg:justify-end gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.12em]">
            <NavLink to="/history" className="hover:text-amber-200/90 transition-colors">
              History
            </NavLink>
            <NavLink to="/profile" className="hover:text-amber-200/90 transition-colors">
              Settings
            </NavLink>
            <button
              type="button"
              onClick={() => navigate('/bet')}
              className="inline-flex items-center gap-1.5 hover:text-amber-200/90 transition-colors"
              aria-label="Search games"
            >
              <Search size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden inline-flex items-center gap-1.5 hover:text-amber-200/90 transition-colors"
              aria-label="Log out"
            >
              <LogOut size={16} strokeWidth={2.5} />
            </button>
          </nav>
        </div>
      </header>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 xl:grid-cols-4 flex-1 min-h-0 auto-rows-fr xl:min-h-[min(calc(100dvh-5.75rem),980px)] xl:max-h-[min(calc(100dvh-5.75rem),980px)] xl:items-stretch">
        {PANELS.map((panel, i) => (
          <section
            key={panel.title}
            className="home-landing-panel relative flex min-h-[280px] min-[900px]:min-h-[360px] xl:min-h-0 xl:h-full flex-col border-b border-white/10 min-[900px]:border-r min-[900px]:last:border-r-0 xl:border-b-0 xl:border-r xl:last:border-r-0 bg-slate-900"
          >
            <div
              className="home-landing-overlay absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: isLightMode
                  ? `linear-gradient(to top, rgba(248, 250, 252, 0.9) 0%, rgba(248, 250, 252, 0.62) 42%, rgba(248, 250, 252, 0.45) 100%), url(${panel.image})`
                  : `linear-gradient(to top, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.45) 42%, rgba(15, 23, 42, 0.25) 100%), url(${panel.image})`,
              }}
              aria-hidden
            />
            <div className="relative z-10 flex flex-1 flex-col justify-between gap-6 p-5 sm:p-6 lg:p-8 min-h-0">
              <div className="flex flex-col gap-3 shrink-0">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {panel.title}
                </h2>
                <p className="text-sm text-white/85 leading-snug max-w-[28ch]">{panel.description}</p>
              </div>
              <div className="flex flex-col gap-2.5 items-start shrink-0">
                {panel.actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={a.disabled}
                    onClick={() => {
                      if (a.onClick) a.onClick();
                      else if (a.to) navigate(a.to);
                    }}
                    className={`home-ghost-btn ${ghostBtn} ${a.disabled ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
                {i === 3 && (
                  <button
                    type="button"
                    onClick={onDailyBonus}
                    disabled={!dailyBonusAvailable}
                    className={`home-ghost-btn ${ghostBtn} border-amber-400/60 text-amber-50 hover:bg-amber-500/10 ${
                      !dailyBonusAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Gift size={16} strokeWidth={2.5} />
                    {dailyBonusAvailable ? 'Daily bonus' : 'Bonus claimed'}
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
