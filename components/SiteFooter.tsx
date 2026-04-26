import React from 'react';
import { NavLink } from 'react-router-dom';

const companyLinks = [
  { to: '/bet', label: 'Home' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Settings' },
];

const supportLinks = [
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/history', label: 'History' },
  { to: '/help', label: 'Help' },
];

export const SiteFooter: React.FC = () => {
  return (
    <footer className="px-4 py-10 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-[1.7fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold text-slate-200">BetHub</p>
          <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
            Simulated betting with fake currency. Explore odds, challenge friends, and track your picks.
          </p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-slate-600">Created by Five Guys</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Company</p>
          <nav className="mt-4 flex flex-col gap-2">
            {companyLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-xs uppercase tracking-[0.16em] transition-colors ${
                    isActive ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Support</p>
          <nav className="mt-4 flex flex-col gap-2">
            {supportLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-xs uppercase tracking-[0.16em] transition-colors ${
                    isActive ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
