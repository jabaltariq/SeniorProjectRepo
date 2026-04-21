import React, {useEffect, useState} from 'react';
import {Bet, Friend, SocialActivity} from "@/models";

interface MessageViewProps {
    friends: Friend[];
}

export const MessageView : React.FC<MessageViewProps> = ({friends, messages}) => {

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                {/* Friends List Window */}
                <div className="space-y-3 flex-items-center">
                    <div className="glass-card rounded-2xl overflow-hidden border-slate-800 space-y-3">
                        {friends.map(friend => (
                            <div key={friend.id} className="glass-card rounded-2xl p-4 flex items-center justify-between border-slate-800 group hover:border-blue-500/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                                            {friend.avatar.toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold">
                                            {friend.name}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Messaging Window*/}
                <div className="">
                    <div className="glass-card rounded-2xl overflow-hidden border-slate-800 space-y-3">

                    </div>
                </div>
            </div>
        </div>
    );
}