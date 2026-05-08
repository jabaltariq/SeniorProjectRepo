import React, { useEffect, useMemo, useRef } from 'react';
import type { Friend } from '../../models';
import { Send, Trash2, X } from 'lucide-react';

export type ChatMessage = {
  id: string;
  threadId: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: number; // epoch ms
};

interface ChatPaneProps {
  currentUserId: string;
  currentUserName: string;
  otherUser: Friend;
  messages: ChatMessage[];
  composerValue: string;
  onComposerValueChange: (next: string) => void;
  onSend: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onClose?: () => void;
}

const formatTime = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const ChatPane: React.FC<ChatPaneProps> = ({
  currentUserId,
  currentUserName,
  otherUser,
  messages,
  composerValue,
  onComposerValueChange,
  onSend,
  onDeleteMessage,
  onOpenProfile,
  onClose,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const otherInitials = useMemo(() => otherUser.avatar || otherUser.name.slice(0, 2), [otherUser]);

  useEffect(() => {
    // Scroll to newest message on each update.
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-[72vh] min-h-[520px]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
              {otherInitials}
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                otherUser.status === 'online'
                  ? 'bg-green-500'
                  : otherUser.status === 'away'
                    ? 'bg-yellow-500'
                    : 'bg-slate-600'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <button
                type="button"
                onClick={() => onOpenProfile?.(otherUser.id)}
                className="font-black text-slate-100 truncate hover:text-blue-300 transition-colors text-left"
                title={`Open ${otherUser.name}'s profile`}
              >
                {otherUser.name}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{otherUser.lastActive}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-2 text-slate-300 hover:bg-slate-950/50 hover:text-white transition-colors"
              aria-label="Close messages"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="chat-pane-surface flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-slate-950/25"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-6">
            <div className="max-w-sm">
              <p className="text-slate-300 font-bold">No messages yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Send the first message to start your thread.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isSelf = m.fromUserId === currentUserId;
              return (
                <div
                  key={m.id}
                  className={`group flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`chat-bubble max-w-[80%] rounded-2xl border px-3 py-2.5 ${
                      isSelf
                        ? 'chat-bubble-self bg-blue-600/15 border-blue-400/30'
                        : 'chat-bubble-other bg-slate-950/20 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!isSelf && (
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-[11px]">
                            {otherInitials}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm chat-bubble-text whitespace-pre-wrap text-slate-100">{m.text}</p>
                          {isSelf && onDeleteMessage ? (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(m.id)}
                              className="shrink-0 rounded-md border border-slate-700/60 bg-slate-950/20 p-1 text-slate-400 hover:text-red-300 hover:border-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                              aria-label="Delete message"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                        <div className={`mt-1 text-[10px] font-bold ${isSelf ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isSelf ? currentUserName : otherUser.name} • {formatTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-slate-700/60">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="sr-only" htmlFor="chatComposer">
              Message
            </label>
            <textarea
              id="chatComposer"
              value={composerValue}
              onChange={(e) => onComposerValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Write a message..."
              rows={1}
              className="chat-composer w-full resize-none rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/60"
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={composerValue.trim().length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:hover:bg-slate-700 px-3 py-2.5 text-xs font-bold text-white transition-colors"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

