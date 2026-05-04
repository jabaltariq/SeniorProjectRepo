import React, { useEffect, useState } from 'react';
import { Sparkles, Ticket, TrendingUp, RefreshCcw } from 'lucide-react';
import { getUserBoosts, UserBoosts, BoostType } from '@/services/dbOps.ts';

interface BoostsCardProps {
    uid: string;
    activeBoost: BoostType | null;
    onSelectBoost: (boost: BoostType | null) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

const BOOSTS: {
    type: BoostType;
    label: string;
    description: string;
    icon: React.ReactNode;
    usedKey: keyof UserBoosts;
    activeColor: string;
    activeBorder: string;
    activeBg: string;
    usedColor: string;
}[] = [
    {
        type:         'double_payout',
        label:        'Double Payout',
        description:  'Win? We double your profit.',
        icon:         <TrendingUp size={13} />,
        usedKey:      'doublePayoutUsed',
        activeColor:  'text-amber-200',
        activeBorder: 'border-amber-400',
        activeBg:     'bg-amber-500/20 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]',
        usedColor:    'text-slate-600',
    },
    {
        type:         'money_back',
        label:        'Money Back',
        description:  'Lose? Get your stake back.',
        icon:         <RefreshCcw size={13} />,
        usedKey:      'moneyBackUsed',
        activeColor:  'text-cyan-200',
        activeBorder: 'border-cyan-400',
        activeBg:     'bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.4)]',
        usedColor:    'text-slate-600',
    },
];

export const BoostsCard: React.FC<BoostsCardProps> = ({ uid, activeBoost, onSelectBoost }) => {
    const [expanded, setExpanded]   = useState(false);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [boosts, setBoosts]       = useState<UserBoosts | null>(null);

    useEffect(() => {
        if (!expanded) return;
        let cancelled = false;

        async function load() {
            setLoadState('loading');
            try {
                const result = await getUserBoosts(uid);
                if (!cancelled) {
                    setBoosts(result);
                    setLoadState('ready');
                }
            } catch {
                if (!cancelled) setLoadState('error');
            }
        }

        load();
        return () => { cancelled = true; };
    }, [expanded, uid]);

    const handleBoostClick = (type: BoostType) => {
        // Toggle off if already active, otherwise activate
        onSelectBoost(activeBoost === type ? null : type);
    };

    // Days until next Sunday reset
    const daysUntilReset = () => {
        const now = new Date();
        const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
        return daysUntilSunday;
    };

    const renderBody = () => {
        if (loadState === 'loading') {
            return <p className="text-xs text-slate-400 py-4 text-center animate-pulse">Loading boosts...</p>;
        }
        if (loadState === 'error') {
            return <p className="text-xs text-red-400 py-4 text-center">Failed to load boosts.</p>;
        }
        if (!boosts) return null;

        const allUsed = boosts.doublePayoutUsed && boosts.moneyBackUsed;

        return (
            <div className="space-y-2">
                <p className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Select a boost before placing your bet.</span>
                    <span className="text-slate-600">Resets in {daysUntilReset()}d</span>
                </p>

                {BOOSTS.map((boost) => {
                    const isUsed   = boosts[boost.usedKey] as boolean;
                    const isActive = activeBoost === boost.type;

                    return (
                        <button
                            key={boost.type}
                            onClick={() => !isUsed && handleBoostClick(boost.type)}
                            disabled={isUsed}
                            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                                isUsed
                                    ? 'border-slate-800 bg-slate-900/40 cursor-not-allowed opacity-40'
                                    : isActive
                                        ? `${boost.activeBorder} ${boost.activeBg}`
                                        : 'border-slate-700 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/60'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`${isActive ? boost.activeColor : isUsed ? boost.usedColor : 'text-slate-400'}`}>
                                        {boost.icon}
                                    </span>
                                    <span className={`text-xs font-bold ${isActive ? boost.activeColor : isUsed ? 'text-slate-600' : 'text-slate-200'}`}>
                                        {boost.label}
                                    </span>
                                </div>
                                {isUsed ? (
                                    <span className="text-[10px] font-bold text-slate-600 uppercase">Used</span>
                                ) : isActive ? (
                                    <span className={`text-[10px] font-bold uppercase ${boost.activeColor}`}>Active</span>
                                ) : (
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase">1× left</span>
                                )}
                            </div>
                            <p className={`text-[10px] mt-0.5 ml-5 ${isUsed ? 'text-slate-700' : 'text-slate-500'}`}>
                                {boost.description}
                            </p>
                        </button>
                    );
                })}

                {allUsed && (
                    <p className="text-[10px] text-slate-600 text-center pt-1">
                        All boosts used — resets Sunday midnight UTC.
                    </p>
                )}

                {activeBoost && (
                    <p className="text-[10px] text-center font-semibold text-amber-300/80 pt-1">
                        ✦ Boost active — place a bet from the board to apply it
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
            >
                <span className="inline-flex items-center gap-2 text-xs font-bold text-amber-300/90">
                    <Sparkles size={13} className="text-amber-400" />
                    Weekly Boosts
                    {activeBoost && (
                        <span className="text-[10px] font-semibold text-amber-400/70 normal-case">· 1 active</span>
                    )}
                </span>
                <Ticket size={14} className="text-slate-500 shrink-0" aria-hidden />
            </button>

            {expanded && (
                <div className="px-3 pb-3 border-t border-slate-800">
                    <div className="pt-3">
                        {renderBody()}
                    </div>
                </div>
            )}
        </div>
    );
};