import React, {useEffect, useState, useRef} from 'react';
import {Bet, Friend, Message, SocialActivity} from "@/models";

interface MessageViewProps {
    friends: Friend[];
}


export const MessageView : React.FC<MessageViewProps> = ({friends, importMessages}) => {
    const [messagesList, setMessagesList] = useState<Message[]>([
        {
            id: '1',
            sender: 'current',
            text: 'Chat functionality',
            timestamp: new Date(),
        },
    ])

    const [currMessages, setCurrMessages] = useState<Message[]>([]);

    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messagesList])

    const sendMessage = () => {
        if (!input.trim()) return;

        const newMessage : Message = {
            id: Date.now().toString(),
            sender: 'current',
            text: input.trim(),
            timestamp: new Date(),
        };

        setMessagesList((prev) => [...prev, newMessage]);
        setInput('')


    }

    const keyDown = (e : React.KeyboardEvent) => {
        if (e.key === 'Enter') sendMessage();
    };
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                {/* Friends List Window */}
                <div className="flex flex-col h-full max-h-[500px] w-full max-w-md border border-slate-800 rounded-xl bg-slate-900">
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
                <div className="flex flex-col h-full max-h-[500px] w-full max-w-md border border-slate-800 rounded-xl bg-slate-900">
                    <div className="px-4 py-3 border-b border-slate-800 font-bold text-slate-200">
                        Chat
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {messagesList.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-3 py-2 rounded-xl text-sm max-w-[75%] ${msg.sender === 'me' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                                    <p>{msg.text}</p>
                                    <span className="block text-[10px] text-slate-400 mt-1">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit',})}</span>
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                    <div className="p-3 border-t border-slate-800 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={keyDown}
                            placeholder="Type a message..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/>
                        <button
                            onClick={sendMessage}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}