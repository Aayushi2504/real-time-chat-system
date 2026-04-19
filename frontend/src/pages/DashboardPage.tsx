import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import { getSocket } from '../services/socket';
import type { Conversation, Message, User } from '../types';
import { Avatar } from '../components/Avatar';
import {
  formatConversationTime,
  formatLastSeen,
  formatMessageTimestamp,
} from '../lib/formatChatTime';

function DirectChatStatusLine({ other }: { other: User | null }) {
  if (!other) {
    return null;
  }
  if (other.isOnline) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-medium text-emerald-400/95">Online</span>
      </div>
    );
  }
  const ls = formatLastSeen(other.lastSeenAt);
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
      {ls ? <span>{ls}</span> : <span>Offline</span>}
    </div>
  );
}

function formatOutboundReceipt(status: string): string {
  switch (status) {
    case 'READ':
      return 'Read';
    case 'DELIVERED':
      return 'Delivered';
    case 'SENT':
    default:
      return 'Sent';
  }
}

/** Subtle stacked corners: single / first / middle / last in a run */
function bubbleRadius(mine: boolean, clusterTop: boolean, clusterEnd: boolean): string {
  if (mine) {
    if (clusterTop && clusterEnd) {
      return 'rounded-2xl rounded-br-lg';
    }
    if (clusterTop) {
      return 'rounded-2xl rounded-br-md rounded-b-md';
    }
    if (clusterEnd) {
      return 'rounded-2xl rounded-tr-md rounded-br-lg';
    }
    return 'rounded-md rounded-r-2xl';
  }
  if (clusterTop && clusterEnd) {
    return 'rounded-2xl rounded-bl-lg';
  }
  if (clusterTop) {
    return 'rounded-2xl rounded-bl-md rounded-b-md';
  }
  if (clusterEnd) {
    return 'rounded-2xl rounded-tl-md rounded-bl-lg';
  }
  return 'rounded-md rounded-l-2xl';
}

function otherParticipant(conv: Conversation, myId: string) {
  return conv.participants.find((p) => p.userId !== myId)?.user ?? null;
}

function isGroupConversation(c: Conversation | null): boolean {
  return c?.type === 'GROUP';
}

export default function DashboardPage() {
  const { user, logout, refreshMe } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [showGroup, setShowGroup] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  /** Display name of someone else typing in the open conversation */
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const selectedIsGroup = isGroupConversation(selected);
  const directOther = useMemo(() => {
    if (!selected || !user?.id || selectedIsGroup) {
      return null;
    }
    return otherParticipant(selected, user.id);
  }, [selected, selectedIsGroup, user?.id]);

  const loadConversations = useCallback(async () => {
    const rows = await api.listConversations();
    setConversations(rows);
  }, []);

  const patchConversationUnread = useCallback((conversationId: string, unreadCount: number) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c)),
    );
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(
    async (convId: string, nextCursor?: string | null) => {
      const page = await api.fetchMessages(convId, nextCursor ?? undefined, 40);
      if (nextCursor) {
        setMessages((prev) => [...page.messages, ...prev]);
      } else {
        setMessages(page.messages);
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
        const last = page.messages[page.messages.length - 1];
        if (user?.id && last && last.senderId !== user.id) {
          void (async () => {
            try {
              await api.markMessageDelivered(last.id);
              await api.markMessageRead(last.id);
              patchConversationUnread(convId, 0);
            } catch {
              /* non-fatal */
            }
            await loadConversations();
          })();
        }
      }
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    },
    [user?.id, patchConversationUnread, loadConversations],
  );

  useEffect(() => {
    setTypingName(null);
  }, [selectedId]);

  /**
   * Join + socket handlers must live in one effect: React runs cleanups before the next setup.
   * Previously the listener effect ran *after* the join effect, so on conversation switch we
   * removed `message:new` while still in the room, then re-joined before listeners were attached —
   * realtime messages could be dropped until refresh.
   */
  useEffect(() => {
    const s = getSocket();
    if (!s) {
      return;
    }

    const onNew = (payload: { message: Message }) => {
      const m = payload.message;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) {
          return prev;
        }
        if (m.conversationId !== selectedId) {
          return prev;
        }
        const next = [...prev, m];
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
        return next;
      });

      const isIncoming = m.senderId !== user?.id;
      const inOpenChat = m.conversationId === selectedId;

      if (isIncoming && inOpenChat) {
        void (async () => {
          try {
            await api.markMessageDelivered(m.id);
            await api.markMessageRead(m.id);
            patchConversationUnread(m.conversationId, 0);
          } catch {
            /* non-fatal */
          }
          await loadConversations();
        })();
      } else {
        void loadConversations();
      }
    };

    const onConvUpd = (p: { conversationId?: string; unreadCount?: number }) => {
      if (p?.conversationId != null && typeof p.unreadCount === 'number') {
        patchConversationUnread(p.conversationId, p.unreadCount);
      }
      void loadConversations();
    };

    const onMessageDelivered = (p: {
      messageId: string;
      status?: Message['status'];
      deliveredAt?: string | null;
    }) => {
      setMessages((prev) =>
        prev.map((x) =>
          x.id === p.messageId
            ? {
                ...x,
                status: p.status ?? 'DELIVERED',
                deliveredAt: p.deliveredAt ?? x.deliveredAt,
              }
            : x,
        ),
      );
    };

    const onMessageRead = (p: {
      messageId: string;
      status?: Message['status'];
      readAt?: string | null;
    }) => {
      setMessages((prev) =>
        prev.map((x) =>
          x.id === p.messageId
            ? { ...x, status: p.status ?? 'READ', readAt: p.readAt ?? x.readAt }
            : x,
        ),
      );
    };

    const onTypingStart = (p: {
      conversationId: string;
      userName?: string;
      userId?: string;
      senderId?: string;
    }) => {
      if (p.conversationId !== selectedId || !user?.id) {
        return;
      }
      const typerId = p.senderId ?? p.userId;
      if (typerId === user.id) {
        return;
      }
      setTypingName(p.userName ?? 'Someone');
      if (typingHideTimer.current) {
        clearTimeout(typingHideTimer.current);
      }
      typingHideTimer.current = setTimeout(() => setTypingName(null), 2800);
    };

    const onTypingStop = (p: { conversationId: string; userId?: string; senderId?: string }) => {
      if (p.conversationId !== selectedId || !user?.id) {
        return;
      }
      const id = p.senderId ?? p.userId;
      if (id === user.id) {
        return;
      }
      setTypingName(null);
    };

    s.on('message:new', onNew);
    s.on('conversation:updated', onConvUpd);
    s.on('message:delivered', onMessageDelivered);
    s.on('message:read', onMessageRead);
    s.on('typing:start', onTypingStart);
    s.on('typing:stop', onTypingStop);

    const iv = window.setInterval(() => {
      s.emit('presence:update');
    }, 25000);

    if (selectedId) {
      setCursor(null);
      void loadMessages(selectedId, null);
      s.emit('conversation:join', { conversationId: selectedId }, () => undefined);
    }

    return () => {
      if (selectedId) {
        s.emit('conversation:leave', { conversationId: selectedId });
      }
      s.off('message:new', onNew);
      s.off('conversation:updated', onConvUpd);
      s.off('message:delivered', onMessageDelivered);
      s.off('message:read', onMessageRead);
      s.off('typing:start', onTypingStart);
      s.off('typing:stop', onTypingStop);
      window.clearInterval(iv);
      if (typingHideTimer.current) {
        clearTimeout(typingHideTimer.current);
      }
    };
  }, [selectedId, user?.id, loadMessages, loadConversations, patchConversationUnread]);

  useEffect(() => {
    return () => {
      if (typingEmitTimer.current) {
        clearTimeout(typingEmitTimer.current);
      }
    };
  }, []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !input.trim()) {
      return;
    }
    const text = input.trim();
    setInput('');
    if (typingEmitTimer.current) {
      clearTimeout(typingEmitTimer.current);
      typingEmitTimer.current = null;
    }
    getSocket()?.emit('typing:stop', { conversationId: selectedId });
    try {
      const sent = await api.sendMessage(selectedId, text);
      setMessages((prev) => {
        if (prev.some((x) => x.id === sent.id)) {
          return prev;
        }
        if (sent.conversationId !== selectedId) {
          return prev;
        }
        return [...prev, sent];
      });
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
      void loadConversations();
    } catch {
      setInput(text);
    }
  }

  async function loadOlder() {
    if (!selectedId || !cursor || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    try {
      await loadMessages(selectedId, cursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function startDirect(other: User) {
    const c = await api.createDirect(other.id);
    await loadConversations();
    setSelectedId(c.id);
  }

  async function openGroupModal() {
    const u = await api.listUsers();
    setUsers(u);
    setPicked([]);
    setGroupName('');
    setShowGroup(true);
  }

  async function createGroup() {
    if (!groupName.trim() || picked.length === 0) {
      return;
    }
    const c = await api.createGroup(groupName.trim(), picked);
    setShowGroup(false);
    await loadConversations();
    setSelectedId(c.id);
  }

  return (
    <div className="flex h-screen min-h-0 bg-surface text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-[min(100%,19.5rem)] shrink-0 flex-col border-r border-surface-border bg-surface-raised">
        <div className="border-b border-surface-border px-3 py-3.5 sm:px-4">
          <div className="flex items-center gap-3">
            {user && <Avatar name={user.name} size="lg" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-100">
                {user?.name}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-surface-border hover:bg-surface-elevated hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                title="Refresh"
                aria-label="Refresh conversations"
                onClick={() => void refreshMe().then(() => loadConversations())}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-red-500/30 hover:bg-red-950/25 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35"
                title="Log out"
                aria-label="Log out"
                onClick={() => void logout()}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
              onClick={() => void openGroupModal()}
            >
              New group
            </button>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No conversations yet</p>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === selectedId;
              const other = user?.id ? otherParticipant(c, user.id) : null;
              const rowAvatarName = c.type === 'GROUP' ? c.title || 'Group' : other?.name ?? c.title;
              const previewTime =
                c.latestMessage?.createdAt ?? c.updatedAt;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full gap-3 border-b border-surface-border/80 px-3 py-3 text-left transition sm:px-4 ${
                    isActive
                      ? 'bg-accent/12 ring-inset ring-1 ring-accent/25'
                      : 'hover:bg-surface-muted/40'
                  }`}
                >
                  <Avatar name={rowAvatarName} size="md" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          isActive ? 'text-slate-50' : 'text-slate-200'
                        }`}
                      >
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                        {formatConversationTime(previewTime)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="line-clamp-2 text-xs leading-snug text-slate-500">
                        {c.latestMessage ? (
                          <>
                            {c.type === 'GROUP' && (
                              <span className="font-medium text-slate-400">
                                {c.latestMessage.sender.name}:{' '}
                              </span>
                            )}
                            {c.latestMessage.content}
                          </>
                        ) : (
                          <span className="italic text-slate-600">No messages yet</span>
                        )}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold leading-none text-white shadow-bubble">
                          {c.unreadCount > 99 ? '99+' : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-surface-border bg-surface-strip px-3 py-3 sm:px-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Start a chat
          </p>
          <UserPicker currentUserId={user?.id} onPick={(u) => void startDirect(u)} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col bg-surface-inset">
        {!selected && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium text-slate-300">Select a conversation</p>
            <p className="max-w-sm text-sm text-slate-500">
              Choose a chat from the sidebar or start one from user search below.
            </p>
          </div>
        )}

        {selected && user && (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="shrink-0 border-b border-surface-border bg-surface-strip shadow-header">
              <div className="mx-auto flex max-w-chat items-center gap-3.5 px-5 py-3.5 sm:px-8">
                <Avatar
                  name={selectedIsGroup ? selected.title || 'Group' : directOther?.name ?? selected.title}
                  size="lg"
                  className="ring-2 ring-surface-border"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold tracking-tight text-slate-50 sm:text-lg">
                    {selectedIsGroup ? selected.title || 'Group' : directOther?.name ?? selected.title}
                  </h2>
                  {selectedIsGroup ? (
                    <p className="mt-1 truncate text-xs leading-relaxed text-slate-500">
                      <span className="font-medium text-slate-400">{selected.participants.length}</span> members
                      <span className="mx-1.5 text-slate-600">·</span>
                      {selected.participants.map((p) => p.user.name).join(', ')}
                    </p>
                  ) : (
                    <DirectChatStatusLine other={directOther} />
                  )}
                </div>
              </div>
            </header>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              {/* Same width as header/composer; bubbles capped at 85% so the stream stays a readable column */}
              <div className="mx-auto w-full max-w-chat px-4 py-4 sm:px-8 sm:py-5">
                {hasMore && (
                  <div className="mb-5 flex justify-center">
                    <button
                      type="button"
                      className="rounded-full border border-surface-border bg-surface-elevated px-4 py-1.5 text-xs font-medium text-slate-300 transition hover:border-surface-muted hover:bg-surface-muted hover:text-white disabled:opacity-50"
                      onClick={() => void loadOlder()}
                      disabled={loadingOlder}
                    >
                      {loadingOlder ? 'Loading older…' : 'Load older messages'}
                    </button>
                  </div>
                )}

                {messages.length === 0 && !hasMore ? (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border bg-surface-raised/50 px-6 py-12 text-center">
                    <p className="text-sm font-medium text-slate-300">No messages yet</p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      Start the conversation — your messages appear here in real time.
                    </p>
                  </div>
                ) : (
                  <ul className="flex list-none flex-col" role="list">
                    {messages.map((m, index) => {
                      const mine = m.senderId === user.id;
                      const prev = index > 0 ? messages[index - 1] : null;
                      const next = index < messages.length - 1 ? messages[index + 1] : null;
                      const clusterTop = !prev || prev.senderId !== m.senderId;
                      const clusterEnd = !next || next.senderId !== m.senderId;
                      const showSender = selectedIsGroup && clusterTop;
                      const showMeta = clusterEnd;
                      const receipt = mine && showMeta ? formatOutboundReceipt(m.status) : null;
                      const radii = bubbleRadius(mine, clusterTop, clusterEnd);
                      // Spacing: small gap within same-sender run; medium gap when sender changes
                      const marginTop = clusterTop
                        ? index === 0
                          ? 'mt-0'
                          : 'mt-5'
                        : 'mt-1';
                      const bubblePadY =
                        clusterTop && clusterEnd
                          ? 'py-2.5'
                          : clusterTop
                            ? 'pt-2.5 pb-2'
                            : clusterEnd
                              ? 'pt-2 pb-2.5'
                              : 'py-2';
                      return (
                        <li
                          key={m.id}
                          className={`flex w-full flex-col ${mine ? 'items-end' : 'items-start'} ${marginTop}`}
                        >
                          {showSender && (
                            <span className="mb-1 max-w-[85%] truncate px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {m.sender.name}
                            </span>
                          )}
                          <div
                            className={`max-w-[85%] min-w-0 ${radii} px-3 ${bubblePadY} ${
                              mine
                                ? 'bg-accent text-slate-50 shadow-bubble'
                                : 'border border-surface-border/90 bg-surface-elevated text-slate-100 shadow-bubble'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                              {m.content}
                            </p>
                          </div>
                          {showMeta && (
                            <div
                              className={`mt-0.5 max-w-[85%] px-0.5 text-[10px] tabular-nums leading-none ${
                                mine ? 'text-right text-blue-200/55' : 'text-left text-slate-500'
                              }`}
                            >
                              <span>{formatMessageTimestamp(m.createdAt)}</span>
                              {receipt && (
                                <>
                                  <span className="mx-1 opacity-40" aria-hidden>
                                    ·
                                  </span>
                                  <span>{receipt}</span>
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div ref={bottomRef} className="h-3 shrink-0" aria-hidden />
              </div>
            </div>

            <div className="shrink-0 border-t border-surface-border/80 bg-surface-raised/90 backdrop-blur-sm shadow-dock">
              <div className="mx-auto w-full max-w-chat px-5 pb-2 pt-1.5 sm:px-8">
                {typingName && (
                  <p className="mb-1.5 text-center text-xs text-slate-500" aria-live="polite">
                    <span className="text-slate-400">{typingName}</span> is typing…
                  </p>
                )}
                <form
                  className="flex items-center gap-2 sm:gap-2.5"
                  onSubmit={(e) => void onSend(e)}
                >
                  <label className="sr-only" htmlFor="chat-message-input">
                    Message
                  </label>
                  <input
                    id="chat-message-input"
                    className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-surface-border/90 bg-surface-inset/90 px-3 py-2 text-[15px] leading-snug text-slate-100 placeholder:text-slate-600 transition focus:border-accent/55 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    placeholder="Message…"
                    value={input}
                    autoComplete="off"
                    onChange={(e) => {
                      const v = e.target.value;
                      setInput(v);
                      if (!selectedId || !user?.id) {
                        return;
                      }
                      if (typingEmitTimer.current) {
                        clearTimeout(typingEmitTimer.current);
                      }
                      if (v.trim().length === 0) {
                        getSocket()?.emit('typing:stop', { conversationId: selectedId });
                        return;
                      }
                      typingEmitTimer.current = setTimeout(() => {
                        getSocket()?.emit('typing:start', {
                          conversationId: selectedId,
                          userName: user.name,
                          senderId: user.id,
                        });
                        typingEmitTimer.current = null;
                      }, 400);
                    }}
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised disabled:pointer-events-none disabled:opacity-35 sm:h-10 sm:px-5"
                    disabled={!input.trim()}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {showGroup && (
        <GroupCreateModal
          groupName={groupName}
          setGroupName={setGroupName}
          users={users}
          picked={picked}
          togglePick={(id) =>
            setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onClose={() => setShowGroup(false)}
          onCreate={() => void createGroup()}
        />
      )}
    </div>
  );
}

function UserPicker({ onPick, currentUserId }: { onPick: (u: User) => void; currentUserId?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const rows = await api.searchUsers(q);
        setResults(rows);
      })();
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        className="mb-2 w-full rounded-xl border border-surface-border bg-surface-inset px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="scrollbar-thin max-h-44 overflow-y-auto rounded-xl border border-surface-border bg-surface-inset">
        {results.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-600">No users match your search</p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={u.id === currentUserId}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onPick(u)}
            >
              <Avatar name={u.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{u.name}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function GroupCreateModal({
  groupName,
  setGroupName,
  users,
  picked,
  togglePick,
  onClose,
  onCreate,
}: {
  groupName: string;
  setGroupName: (v: string) => void;
  users: User[];
  picked: string[];
  togglePick: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl">
        <div className="border-b border-surface-border px-5 py-4">
          <h3 id="group-modal-title" className="text-lg font-semibold tracking-tight text-slate-50">
            New group
          </h3>
          <p className="mt-1 text-xs text-slate-500">Add a name and select members.</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <input
            className="w-full rounded-xl border border-surface-border bg-surface-inset px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Members
            </p>
            <div className="scrollbar-thin max-h-52 overflow-y-auto rounded-xl border border-surface-border bg-surface-inset">
              {users.map((u) => {
                const checked = picked.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => togglePick(u.id)}
                    className={`flex w-full items-center gap-3 border-b border-surface-border/60 px-3 py-2.5 text-left transition last:border-b-0 ${
                      checked
                        ? 'bg-accent/15 ring-inset ring-1 ring-accent/30'
                        : 'hover:bg-surface-muted/35'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                        checked
                          ? 'border-accent bg-accent text-white'
                          : 'border-surface-border bg-surface-elevated text-transparent'
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <Avatar name={u.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-surface-border bg-surface-strip px-5 py-3">
          <button
            type="button"
            className="rounded-xl border border-surface-border px-4 py-2 text-sm text-slate-300 transition hover:bg-surface-muted"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dim disabled:opacity-40"
            disabled={!groupName.trim() || picked.length === 0}
            onClick={onCreate}
          >
            Create group
          </button>
        </div>
      </div>
    </div>
  );
}

