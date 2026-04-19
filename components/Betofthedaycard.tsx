import React, { useEffect, useState } from 'react';
import { Flame, Lock, CheckCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { getBetOfTheDay, hasClaimedFreeBet, placeFreeBet, BetOfTheDay, BetOfTheDayOption } from '@/services/dbOps.ts';
import { fetchAndSetBetOfTheDay } from '@/services/oddsApiService.ts';
import { Timestamp } from 'firebase/firestore';

interface BetOfTheDayCardProps {
    uid: string;
}

type CardState = 'loading' | 'no_bet' | 'locked' | 'already_claimed' | 'ready' | 'success' | 'error';

export const BetOfTheDayCard: React.FC<BetOfTheDayCardProps> = ({ uid }) => {
    const [expanded, setExpanded]         = useState(false);
    const [cardState, setCardState]       = useState<CardState>('loading');
    const [bet, setBet]                   = useState<BetOfTheDay | null>(null);
    const [selectedOption, setSelected]   = useState<BetOfTheDayOption | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSeedingBet, setIsSeedingBet] = useState(false);
    const [errorMsg, setErrorMsg]         = useState<string | null>(null);

    // Extracted so we can call it both from useEffect and after seeding
    async function load(cancelled?: { value: boolean }) {
        setCardState('loading');
        setErrorMsg(null);

        const [todaysBet, claimed] = await Promise.all([
            getBetOfTheDay(),
            hasClaimedFreeBet(uid),
        ]);

        if (cancelled?.value) return;

        if (!todaysBet) {
            setCardState('no_bet');
            return;
        }

        setBet(todaysBet);

        if (claimed) {
            setCardState('already_claimed');
            return;
        }

        const now = Timestamp.now();


        setCardState('ready');
    }

    useEffect(() => {
        if (!expanded) return;
        const cancelled = { value: false };
        load(cancelled);
        return () => { cancelled.value = true; };
    }, [expanded, uid]);

    // Calls the Odds API, picks a game starting within 24hrs, saves it to Firestore,
    // then reloads the card. The button only shows when no bet is set (no_bet state).
    const handleSeedBet = async () => {
        setIsSeedingBet(true);
        setErrorMsg(null);
        try {
            const result = await fetchAndSetBetOfTheDay();
            if (!result) {
                setErrorMsg('No eligible games found in the next 24 hours. Try again later.');
                setCardState('no_bet');
            } else {
                await load();
            }
        } catch {
            setErrorMsg('Failed to fetch a game. Check your Odds API key.');
            setCardState('no_bet');
        }
        setIsSeedingBet(false);
    };

    const handlePlace = async () => {
        if (!selectedOption || !bet || isSubmitting) return;
        setIsSubmitting(true);
        setErrorMsg(null);

        const result = await placeFreeBet(uid, selectedOption.label, selectedOption.odds);

        if (result.success) {
            setCardState('success');
        } else {
            switch (result.error) {
                case 'ALREADY_CLAIMED': setCardState('already_claimed'); break;
                case 'BET_LOCKED':      setCardState('locked');          break;
                case 'NO_BET_TODAY':    setCardState('no_bet');          break;
                default:
                    setErrorMsg('Something went wrong. Please try again.');
            }
        }
        setIsSubmitting(false);
    };

    const formatStartTime = (ts: Timestamp) =>
        ts.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const groupedOptions = bet?.options.reduce<Record<string, BetOfTheDayOption[]>>((acc, o) => {
        const key = o.marketKey ?? 'h2h';
        if (!acc[key]) acc[key] = [];
        acc[key].push(o);
        return acc;
    }, {}) ?? {};

    const marketKeyLabel: Record<string, string> = {
        h2h:     'Winner',
        spreads: 'Spread',
        totals:  'Total',
    };

    const renderBody = () => {
        switch (cardState) {
            case 'loading':
                return (
                    <p className="text-xs text-slate-400 py-4 text-center animate-pulse">
                        Loading today's free bet...
                    </p>
                );

            case 'no_bet':
                return (
                    <div className="py-4 flex flex-col items-center gap-3">
                        <p className="text-xs text-slate-500 text-center">
                            No free bet has been set for today.
                        </p>
                        {/*
                          Temporary seed button — shows only when no bet is set for today.
                          Once a Cloud Function is wired up to call fetchAndSetBetOfTheDay()
                          at midnight, this button will never appear and can be removed.
                        */}
                        <button
                            onClick={handleSeedBet}
                            disabled={isSeedingBet}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                isSeedingBet
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                        >
                            <RefreshCw size={11} className={isSeedingBet ? 'animate-spin' : ''} />
                            {isSeedingBet ? 'Fetching game...' : "Set today's bet"}
                        </button>
                        {errorMsg && (
                            <p className="text-xs text-red-400 text-center">{errorMsg}</p>
                        )}
                    </div>
                );

            case 'locked':
                return (

                    <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                        <Lock size={14} />
                        <span>Today's game has ended. Check back tomorrow!</span>
                    </div>

                );

            case 'already_claimed':
                return (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs py-4 justify-center">
                        <CheckCircle size={14} />
                        <span>You've already claimed today's free bet. Come back tomorrow!</span>
                    </div>
                );

            case 'success':
                return (
                    <div className="flex flex-col items-center gap-1 py-4 text-center">
                        <CheckCircle className="text-emerald-400" size={24} />
                        <p className="text-sm font-bold text-emerald-300">Free bet placed!</p>
                        <p className="text-xs text-slate-400">
                            ${(selectedOption?.odds ?? 0) > 0
                            ? (100 * (1 + (selectedOption?.odds ?? 0) / 100)).toFixed(2)
                            : (100 * (1 + 100 / Math.abs(selectedOption?.odds ?? 1))).toFixed(2)
                        } potential payout on <span className="text-slate-200">{selectedOption?.label}</span>
                        </p>
                    </div>
                );

            case 'error':
                return (
                    <p className="text-xs text-red-400 py-4 text-center">{errorMsg}</p>
                );

            case 'ready':
                return (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-slate-100">{bet?.marketTitle}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                Locks at {bet ? formatStartTime(bet.startsAt) : '—'} · Free $100 bet · Stake + profit paid on win
                            </p>
                        </div>

                        {Object.entries(groupedOptions).map(([key, opts]) => (
                            <div key={key}>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    {marketKeyLabel[key] ?? key}
                                </p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {opts.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setSelected(prev => prev?.id === opt.id ? null : opt)}
                                            className={`rounded-lg border px-3 py-2 text-left transition-all ${
                                                selectedOption?.id === opt.id
                                                    ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]'
                                                    : 'border-slate-700 bg-slate-900 hover:border-blue-500/80 hover:bg-blue-600/15'
                                            }`}
                                        >
                                            <p className="text-[10px] text-slate-400 truncate">{opt.label}</p>
                                            <p className={`text-sm font-semibold ${selectedOption?.id === opt.id ? 'text-violet-200' : 'text-blue-300'}`}>
                                                {opt.odds.toFixed(2)}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handlePlace}
                            disabled={!selectedOption || isSubmitting}
                            className={`w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all active:scale-95 ${
                                selectedOption && !isSubmitting
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-700/30'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? 'Placing...' : selectedOption ? `Place Free Bet on ${selectedOption.label}` : 'Select a side'}
                        </button>

                        {errorMsg && (
                            <p className="text-xs text-red-400 text-center">{errorMsg}</p>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
            >
                <span className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <Flame size={13} className="text-orange-400" />
                    Free Bet of the Day
                    <span className="text-[10px] font-semibold text-slate-500 normal-case">· $100 free</span>
                </span>
                {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
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