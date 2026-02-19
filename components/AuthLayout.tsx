import React from 'react';
import { Zap } from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, children }) => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
          <Zap className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">BetHub</h1>
        <p className="text-slate-400 mt-1">Simulated betting with fake currency</p>
      </div>
      <div className="glass-card rounded-2xl p-8 border-slate-800">
        <h2 className="text-xl font-bold text-white mb-6">{title}</h2>
        {children}
      </div>
    </div>
  </div>
);
