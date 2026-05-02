import React from 'react';
import { SiteFooter } from '../components/SiteFooter';

export const HelpView: React.FC = () => {
  return (
    <div className="app-shell min-h-screen bg-gradient-to-br from-slate-800 via-[#0f172a] to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pt-10">
        <main className="flex-1" />
        <SiteFooter />
      </div>
    </div>
  );
};
