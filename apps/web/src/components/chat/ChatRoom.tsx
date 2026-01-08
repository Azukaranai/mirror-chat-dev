'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials, formatMessageTime, formatDateDivider } from '@/lib/utils';
import { useChatStore } from '@/lib/stores';
import type { TypingPayload } from '@/types';

// Icons
const ArrowLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
);

const PaperAirplaneIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
);

const reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ReactionSummary {
    type: string;
    count: number;
    reacted: boolean;
}

interface Message {
    id: string;
    content: string;
    kind: 'text' | 'attachment' | 'shared_ai_thread' | 'system';
    sender_user_id: string;
    sender_name: string;
    sender_avatar: string | null;
    created_at: string;
    is_mine: boolean;
    reactions: ReactionSummary[];
}

interface RoomInfo {
    name: string;
    avatar_path: string | null;
    type: 'dm' | 'group';
}

interface ChatRoomProps {
    roomId: string;
    userId: string;
}

export function ChatRoom({ roomId, userId }: ChatRoomProps) {
    const supabase = useMemo(() => createClient(), []);
    const typingUsers = useChatStore((state) => state.typingUsers);
    const addTypingUser = useChatStore((state) => state.addTypingUser);
    const removeTypingUser = useChatStore((state) => state.removeTypingUser);
    const setTypingUsers = useChatStore((state) => state.setTypingUsers);
    const [messages, setMessages] = useState<Message[]>([]);
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [openReactionPicker, setOpenReactionPicker] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const channelRef = useRef<any>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef(0);
    const messagesRef = useRef<Message[]>([]);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const buildReactionSummary = useCallback(
        (rows: any[] | null | undefined) => {
            if (!rows || rows.length === 0) return [];
            const map = new Map<string, ReactionSummary>();
            rows.forEach((row) => {
                const type = row.reaction_type as string;
                const existing = map.get(type);
                if (!existing) {
                    map.set(type, {
                        type,
                        count: 1,
                        reacted: row.user_id === userId,
                    });
                } else {
                    map.set(type, {
                        type,
                        count: existing.count + 1,
                        reacted: existing.reacted || row.user_id === userId,
                    });
                }
            });
            return Array.from(map.values());
        },
        [userId]
    );

    const refreshReactions = useCallback(
        async (messageId: string) => {
            const { data } = await supabase
                .from('message_reactions')
                .select('reaction_type, user_id')
                .eq('message_id', messageId);
            if (!data) return;
            const summary = buildReactionSummary(data as any[]);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId ? { ...msg, reactions: summary } : msg
                )
            );
        },
        [supabase, buildReactionSummary]
    );

    const sendTyping = useCallback(
        (isTyping: boolean) => {
            const channel = channelRef.current;
            if (!channel) return;
            const payload: TypingPayload & { displayName?: string } = {
                userId,
                isTyping,
                timestamp: Date.now(),
            };
            if (currentUserName) {
                payload.displayName = currentUserName;
            }
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload,
            });
        },
        [userId, currentUserName]
    );

    const stopTyping = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        sendTyping(false);
    }, [sendTyping]);

    // Fetch room info and messages
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const { data: me } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .single();
            setCurrentUserName((me as any)?.display_name || null);

            // Get room info
            const { data: room } = await supabase
                .from('rooms')
                .select('type, group_id')
                .eq('id', roomId)
                .single();

            if (!room) {
                setLoading(false);
                return;
            }

            let name = '';
            let avatarPath: string | null = null;

            if ((room as any).type === 'dm') {
                const { data: otherMember } = await supabase
                    .from('room_members')
                    .select('profiles!inner(display_name, avatar_path)')
                    .eq('room_id', roomId)
                    .neq('user_id', userId)
                    .single();

                if (otherMember) {
                    const profile = (otherMember as any).profiles;
                    name = Array.isArray(profile) ? profile[0].display_name : profile.display_name;
                    avatarPath = Array.isArray(profile) ? profile[0].avatar_path : profile.avatar_path;
                }
            } else if ((room as any).group_id) {
                const { data: group } = await supabase
                    .from('groups')
                    .select('name, avatar_path')
                    .eq('id', (room as any).group_id)
                    .single();

                if (group) {
                    name = (group as any).name;
                    avatarPath = (group as any).avatar_path;
                }
            }

            setRoomInfo({ name, avatar_path: avatarPath, type: (room as any).type });

            // Get messages
            const { data: msgs } = await supabase
                .from('messages')
                .select(`
          id,
          content,
          kind,
          sender_user_id,
          created_at,
          profiles!messages_sender_user_id_fkey(display_name, avatar_path),
          message_reactions(reaction_type, user_id)
        `)
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (msgs) {
                const formattedMsgs: Message[] = msgs.map((m: any) => {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                    return {
                        id: m.id,
                        content: m.content,
                        kind: m.kind,
                        sender_user_id: m.sender_user_id,
                        sender_name: profile?.display_name || 'Unknown',
                        sender_avatar: profile?.avatar_path,
                        created_at: m.created_at,
                        is_mine: m.sender_user_id === userId,
                        reactions: buildReactionSummary(m.message_reactions),
                    };
                });
                setMessages(formattedMsgs);
            }

            // Update last read
            if (msgs && msgs.length > 0) {
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: (msgs as any[])[(msgs as any[]).length - 1].id })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
            }

            setLoading(false);
        };

        fetchData();

        // Subscribe to new messages
        const channel = supabase.channel(`room:${roomId}`);

        channel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            },
            async (payload) => {
                const newMsg = payload.new as any;

                // Get sender info
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('display_name, avatar_path')
                    .eq('user_id', newMsg.sender_user_id)
                    .single();

                const formattedMsg: Message = {
                    id: newMsg.id,
                    content: newMsg.content,
                    kind: newMsg.kind,
                    sender_user_id: newMsg.sender_user_id,
                    sender_name: (sender as any)?.display_name || 'Unknown',
                    sender_avatar: (sender as any)?.avatar_path,
                    created_at: newMsg.created_at,
                    is_mine: newMsg.sender_user_id === userId,
                    reactions: [],
                };

                setMessages((prev) => [...prev, formattedMsg]);

                // Update last read
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: newMsg.id })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
            }
        );

        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'message_reactions',
            },
            (payload) => {
                const record = (payload.new || payload.old) as any;
                const messageId = record?.message_id;
                if (!messageId) return;
                if (!messagesRef.current.some((msg) => msg.id === messageId)) return;
                refreshReactions(messageId);
            }
        );

        channel.on(
            'broadcast',
            { event: 'typing' },
            (payload) => {
                const data = payload.payload as TypingPayload & { displayName?: string };
                if (!data?.userId || data.userId === userId) return;
                if (data.isTyping) {
                    addTypingUser(roomId, {
                        userId: data.userId,
                        displayName: data.displayName || '誰か',
                        timestamp: data.timestamp || Date.now(),
                    });
                } else {
                    removeTypingUser(roomId, data.userId);
                }
            }
        );

        channel.subscribe();
        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
            setTypingUsers(roomId, []);
        };
    }, [supabase, roomId, userId, buildReactionSummary, refreshReactions, addTypingUser, removeTypingUser, setTypingUsers]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Send message
    const handleSend = async () => {
        if (!input.trim() || sending) return;

        const content = input.trim();
        stopTyping();
        setInput('');
        setSending(true);

        try {
            await supabase.from('messages').insert({
                room_id: roomId,
                sender_user_id: userId,
                kind: 'text',
                content,
            } as any);
        } catch (error) {
            console.error('Failed to send message:', error);
            setInput(content); // Restore input on error
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (value: string) => {
        setInput(value);

        if (!value.trim()) {
            stopTyping();
            return;
        }

        const now = Date.now();
        if (now - lastTypingSentRef.current > 1200) {
            sendTyping(true);
            lastTypingSentRef.current = now;
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(false);
            typingTimeoutRef.current = null;
        }, 1800);
    };

    const updateReactionSummary = (
        reactions: ReactionSummary[],
        reactionType: string,
        reacted: boolean
    ) => {
        const existing = reactions.find((r) => r.type === reactionType);
        if (!existing && reacted) {
            return [...reactions, { type: reactionType, count: 1, reacted: true }];
        }
        if (!existing) return reactions;

        const nextCount = reacted ? existing.count + 1 : existing.count - 1;
        if (nextCount <= 0) {
            return reactions.filter((r) => r.type !== reactionType);
        }
        return reactions.map((r) =>
            r.type === reactionType ? { ...r, count: nextCount, reacted } : r
        );
    };

    const handleToggleReaction = async (messageId: string, reactionType: string) => {
        const message = messagesRef.current.find((msg) => msg.id === messageId);
        if (!message) return;

        const hasReacted = message.reactions.some(
            (reaction) => reaction.type === reactionType && reaction.reacted
        );

        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId
                    ? {
                        ...msg,
                        reactions: updateReactionSummary(msg.reactions, reactionType, !hasReacted),
                    }
                    : msg
            )
        );

        try {
            if (hasReacted) {
                await supabase
                    .from('message_reactions')
                    .delete()
                    .eq('message_id', messageId)
                    .eq('user_id', userId)
                    .eq('reaction_type', reactionType);
            } else {
                await supabase.from('message_reactions').insert({
                    message_id: messageId,
                    user_id: userId,
                    reaction_type: reactionType,
                } as any);
            }
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
        } finally {
            refreshReactions(messageId);
        }
    };

    // Group messages by date
    const groupedMessages = useMemo(() => {
        const groups: { date: string; messages: Message[] }[] = [];
        let currentDate = '';

        messages.forEach((msg) => {
            const msgDate = new Date(msg.created_at).toDateString();
            if (msgDate !== currentDate) {
                currentDate = msgDate;
                groups.push({ date: msg.created_at, messages: [msg] });
            } else {
                groups[groups.length - 1].messages.push(msg);
            }
        });

        return groups;
    }, [messages]);

    const activeTypingUsers = useMemo(() => {
        const list = typingUsers.get(roomId) || [];
        const now = Date.now();
        return list.filter((user) => user.userId !== userId && now - user.timestamp < 4000);
    }, [typingUsers, roomId, userId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
                <Link href="/talk" className="md:hidden btn-icon">
                    <ArrowLeftIcon className="w-5 h-5" />
                </Link>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                    {roomInfo?.avatar_path ? (
                        <Image
                            src={getStorageUrl('avatars', roomInfo.avatar_path)}
                            alt={roomInfo.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-white font-bold text-sm">
                            {getInitials(roomInfo?.name || '')}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">{roomInfo?.name || 'トーク'}</h2>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {groupedMessages.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        {/* Date divider */}
                        <div className="flex items-center gap-4 text-xs text-surface-400 my-4">
                            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
                            <span>{formatDateDivider(group.date)}</span>
                            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
                        </div>

                        {/* Messages */}
                        {group.messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'} mb-2`}
                            >
                                {!msg.is_mine && roomInfo?.type === 'group' && (
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                                        {msg.sender_avatar ? (
                                            <Image
                                                src={getStorageUrl('avatars', msg.sender_avatar)}
                                                alt={msg.sender_name}
                                                width={32}
                                                height={32}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white text-xs font-bold">
                                                {getInitials(msg.sender_name)}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className={msg.is_mine ? 'max-w-[70%]' : 'max-w-[70%]'}>
                                    {!msg.is_mine && roomInfo?.type === 'group' && (
                                        <p className="text-xs text-surface-500 mb-1">{msg.sender_name}</p>
                                    )}
                                    <div
                                        className={
                                            msg.is_mine
                                                ? 'message-bubble-sent'
                                                : 'message-bubble-received'
                                        }
                                    >
                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                        <span
                                            className={`text-xs mt-1 block ${msg.is_mine ? 'text-white/70' : 'text-surface-400'
                                                }`}
                                        >
                                            {formatMessageTime(msg.created_at)}
                                        </span>
                                    </div>
                                    <div
                                        className={`mt-1 flex flex-wrap items-center gap-1 ${msg.is_mine ? 'justify-end' : 'justify-start'
                                            }`}
                                    >
                                        {msg.reactions.map((reaction) => (
                                            <button
                                                key={reaction.type}
                                                onClick={() => handleToggleReaction(msg.id, reaction.type)}
                                                className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${reaction.reacted
                                                    ? 'border-primary-400 bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                                                    : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900'
                                                    }`}
                                            >
                                                {reaction.type} {reaction.count}
                                            </button>
                                        ))}
                                        <div className="relative">
                                            <button
                                                onClick={() =>
                                                    setOpenReactionPicker((prev) => (prev === msg.id ? null : msg.id))
                                                }
                                                className="px-2 py-0.5 rounded-full text-xs border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900"
                                            >
                                                😊
                                            </button>
                                            {openReactionPicker === msg.id && (
                                                <div
                                                    className={`absolute bottom-full mb-1 z-10 flex gap-1 rounded-lg border border-surface-200 bg-white p-2 shadow-lg dark:border-surface-700 dark:bg-surface-900 ${msg.is_mine ? 'right-0' : 'left-0'
                                                        }`}
                                                >
                                                    {reactionOptions.map((reaction) => (
                                                        <button
                                                            key={reaction}
                                                            onClick={() => {
                                                                handleToggleReaction(msg.id, reaction);
                                                                setOpenReactionPicker(null);
                                                            }}
                                                            className="text-lg hover:scale-110 transition-transform"
                                                        >
                                                            {reaction}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-surface-200 dark:border-surface-800 p-3 bg-white dark:bg-surface-900 safe-bottom">
                {activeTypingUsers.length > 0 && (
                    <div className="typing-indicator text-sm text-surface-500">
                        <span>
                            {activeTypingUsers.map((user) => user.displayName).join(', ')} が入力中...
                        </span>
                        <div className="flex gap-1 ml-2">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                        </div>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={stopTyping}
                            placeholder="メッセージを入力..."
                            rows={1}
                            className="input resize-none py-2.5 min-h-[42px] max-h-32"
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="btn-primary p-2.5 rounded-full flex-shrink-0"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
