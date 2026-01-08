'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials, formatMessageTime, formatDateDivider, parseSharedAIThreadCard } from '@/lib/utils';
import { useChatStore, useOverlayStore, useSplitStore } from '@/lib/stores';
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

const PaperClipIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 5.25L8.25 15.375a3 3 0 104.243 4.243L19.5 12.61a4.5 4.5 0 10-6.364-6.364L5.25 14.132" />
    </svg>
);

const ReplyIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9.75a3 3 0 013 3v3.75m-13.5 0L3 18.75m3-3.75L3 18.75m3-3.75V8.25" />
    </svg>
);

const reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ReactionSummary {
    type: string;
    count: number;
    reacted: boolean;
}

interface AttachmentItem {
    id: string;
    bucket: string;
    object_path: string;
    mime: string;
    size: number;
}

interface Message {
    id: string;
    content: string | null;
    kind: 'text' | 'attachment' | 'shared_ai_thread' | 'system';
    sender_user_id: string;
    sender_name: string;
    sender_avatar: string | null;
    created_at: string;
    is_mine: boolean;
    reactions: ReactionSummary[];
    reply_to_message_id?: string | null;
    attachments?: AttachmentItem[];
    sharedCard?: ReturnType<typeof parseSharedAIThreadCard>;
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
    const router = useRouter();
    const openWindow = useOverlayStore((state) => state.openWindow);
    const addSplitTab = useSplitStore((state) => state.addTab);
    const typingUsers = useChatStore((state) => state.typingUsers);
    const addTypingUser = useChatStore((state) => state.addTypingUser);
    const removeTypingUser = useChatStore((state) => state.removeTypingUser);
    const setTypingUsers = useChatStore((state) => state.setTypingUsers);
    const [messages, setMessages] = useState<Message[]>([]);
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
    const [input, setInput] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [openReactionPicker, setOpenReactionPicker] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const formatFileSize = (size: number) => {
        if (size < 1024) return `${size}B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    };

    const fetchAttachments = useCallback(
        async (messageId: string) => {
            const { data } = await supabase
                .from('message_attachments')
                .select('id, bucket, object_path, mime, size')
                .eq('message_id', messageId);
            if (!data) return;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId ? { ...msg, attachments: data as AttachmentItem[] } : msg
                )
            );
        },
        [supabase]
    );

    const handleDownloadAttachment = useCallback(
        async (attachment: AttachmentItem) => {
            const { data, error } = await supabase.storage
                .from(attachment.bucket)
                .download(attachment.object_path);
            if (error || !data) {
                setAttachmentError('添付ファイルの取得に失敗しました');
                return;
            }
            const url = URL.createObjectURL(data);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 1000 * 60);
        },
        [supabase]
    );

    const getAttachmentName = (path: string) => {
        const parts = path.split('/');
        return parts[parts.length - 1] || 'file';
    };

    const scrollToMessage = (messageId: string) => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

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
          reply_to_message_id,
          sender_user_id,
          created_at,
          profiles!messages_sender_user_id_fkey(display_name, avatar_path),
          message_attachments(id, bucket, object_path, mime, size),
          message_reactions(reaction_type, user_id)
        `)
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (msgs) {
                const formattedMsgs: Message[] = msgs.map((m: any) => {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                    const sharedCard = m.kind === 'shared_ai_thread'
                        ? parseSharedAIThreadCard(m.content)
                        : null;
                    return {
                        id: m.id,
                        content: m.content,
                        kind: m.kind,
                        reply_to_message_id: m.reply_to_message_id,
                        sender_user_id: m.sender_user_id,
                        sender_name: profile?.display_name || 'Unknown',
                        sender_avatar: profile?.avatar_path,
                        created_at: m.created_at,
                        is_mine: m.sender_user_id === userId,
                        attachments: (m.message_attachments || []) as AttachmentItem[],
                        sharedCard,
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
                    reply_to_message_id: newMsg.reply_to_message_id,
                    sender_user_id: newMsg.sender_user_id,
                    sender_name: (sender as any)?.display_name || 'Unknown',
                    sender_avatar: (sender as any)?.avatar_path,
                    created_at: newMsg.created_at,
                    is_mine: newMsg.sender_user_id === userId,
                    attachments: [],
                    sharedCard: newMsg.kind === 'shared_ai_thread'
                        ? parseSharedAIThreadCard(newMsg.content)
                        : null,
                    reactions: [],
                };

                setMessages((prev) => [...prev, formattedMsg]);

                if (newMsg.kind === 'attachment') {
                    fetchAttachments(newMsg.id);
                }

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
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'message_attachments',
            },
            (payload) => {
                const record = payload.new as any;
                if (!record?.message_id) return;
                if (!messagesRef.current.some((msg) => msg.id === record.message_id)) return;
                fetchAttachments(record.message_id);
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
    }, [supabase, roomId, userId, buildReactionSummary, refreshReactions, addTypingUser, removeTypingUser, setTypingUsers, fetchAttachments]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Send message
    const handleSend = async () => {
        if ((!input.trim() && pendingAttachments.length === 0) || sending) return;

        const content = input.trim();
        const attachmentsSnapshot = [...pendingAttachments];
        const replySnapshot = replyTo;
        stopTyping();
        setInput('');
        setPendingAttachments([]);
        setReplyTo(null);
        setAttachmentError(null);
        setSending(true);

        try {
            const { data: newMessage, error: messageError } = await supabase
                .from('messages')
                .insert({
                    room_id: roomId,
                    sender_user_id: userId,
                    kind: attachmentsSnapshot.length > 0 ? 'attachment' : 'text',
                    content: content || null,
                    reply_to_message_id: replySnapshot?.id ?? null,
                } as any)
                .select('id')
                .single();

            if (messageError || !newMessage) {
                throw messageError || new Error('Failed to create message');
            }

            if (attachmentsSnapshot.length > 0) {
                for (const file of attachmentsSnapshot) {
                    const safeName = file.name.replace(/\s+/g, '_');
                    const path = `${roomId}/${newMessage.id}/${Date.now()}_${safeName}`;
                    const { error: uploadError } = await supabase.storage
                        .from('chat-attachments')
                        .upload(path, file, {
                            contentType: file.type || 'application/octet-stream',
                        });

                    if (uploadError) {
                        setAttachmentError('添付ファイルのアップロードに失敗しました');
                        continue;
                    }

                    await supabase.from('message_attachments').insert({
                        message_id: newMessage.id,
                        bucket: 'chat-attachments',
                        object_path: path,
                        mime: file.type || 'application/octet-stream',
                        size: file.size,
                    } as any);
                }

                fetchAttachments(newMessage.id);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            setInput(content);
            setPendingAttachments(attachmentsSnapshot);
            setReplyTo(replySnapshot);
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
        if (attachmentError) {
            setAttachmentError(null);
        }

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

    const handleAttachClick = () => {
        fileInputRef.current?.click();
    };

    const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const maxSize = 25 * 1024 * 1024;
        const validFiles: File[] = [];
        let sizeError = false;

        files.forEach((file) => {
            if (file.size > maxSize) {
                sizeError = true;
                return;
            }
            validFiles.push(file);
        });

        if (sizeError) {
            setAttachmentError('ファイルサイズは25MB以下にしてください');
        }

        if (validFiles.length > 0) {
            setPendingAttachments((prev) => [...prev, ...validFiles]);
        }

        event.target.value = '';
    };

    const handleRemovePendingAttachment = (index: number) => {
        setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
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
                        {group.messages.map((msg) => {
                            const replyTarget = msg.reply_to_message_id
                                ? messagesRef.current.find((m) => m.id === msg.reply_to_message_id)
                                : null;
                            const hasAttachments = (msg.attachments || []).length > 0;
                            const sharedCard = msg.sharedCard;

                            return (
                                <div
                                    key={msg.id}
                                    data-message-id={msg.id}
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
                                            {replyTarget && (
                                                <button
                                                    onClick={() => scrollToMessage(replyTarget.id)}
                                                    className="w-full text-left text-xs rounded-lg border border-surface-200/60 dark:border-surface-700/60 bg-surface-50/60 dark:bg-surface-800/40 px-2 py-1 mb-2"
                                                >
                                                    <p className="font-medium text-surface-500 dark:text-surface-300">
                                                        {replyTarget.sender_name}
                                                    </p>
                                                    <p className="truncate text-surface-500">
                                                        {replyTarget.kind === 'shared_ai_thread'
                                                            ? '🤖 AIスレッドを共有しました'
                                                            : replyTarget.kind === 'attachment'
                                                                ? '📎 添付ファイル'
                                                                : replyTarget.content || 'メッセージ'}
                                                    </p>
                                                </button>
                                            )}

                                            {msg.kind === 'shared_ai_thread' && sharedCard ? (
                                                <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 p-3 space-y-2">
                                                    <p className="text-xs text-surface-500">AIスレッド共有</p>
                                                    <p className="font-medium truncate">{sharedCard.titleSnapshot || 'AIスレッド'}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => router.push(`/ai/${sharedCard.threadId}`)}
                                                            className="btn-secondary text-xs px-3 py-1"
                                                        >
                                                            開く
                                                        </button>
                                                        <button
                                                            onClick={() => addSplitTab(sharedCard.threadId, sharedCard.titleSnapshot || 'AIスレッド')}
                                                            className="btn-secondary text-xs px-3 py-1"
                                                        >
                                                            分割
                                                        </button>
                                                        <button
                                                            onClick={() => openWindow(sharedCard.threadId)}
                                                            className="btn-secondary text-xs px-3 py-1"
                                                        >
                                                            オーバーレイ
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {msg.content && (
                                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                    )}
                                                    {hasAttachments && (
                                                        <div className="mt-2 space-y-2">
                                                            {(msg.attachments || []).map((attachment) => (
                                                                <div
                                                                    key={attachment.id}
                                                                    className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/70 dark:bg-surface-900/40 px-2 py-1"
                                                                >
                                                                    <span className="text-sm">
                                                                        {attachment.mime.startsWith('image/') ? '🖼️' : '📎'}
                                                                    </span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm truncate">
                                                                            {getAttachmentName(attachment.object_path)}
                                                                        </p>
                                                                        <p className="text-xs text-surface-500">
                                                                            {formatFileSize(attachment.size)}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleDownloadAttachment(attachment)}
                                                                        className="btn-ghost text-xs px-2 py-1"
                                                                    >
                                                                        ダウンロード
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
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
                                            <button
                                                onClick={() => setReplyTo(msg)}
                                                className="px-2 py-0.5 rounded-full text-xs border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900"
                                            >
                                                <ReplyIcon className="w-4 h-4" />
                                            </button>
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
                            );
                        })}
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
                {replyTo && (
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-2 text-xs">
                        <div className="min-w-0">
                            <p className="font-medium text-surface-500 dark:text-surface-300">
                                {replyTo.sender_name} への返信
                            </p>
                            <p className="truncate text-surface-500">
                                {replyTo.kind === 'shared_ai_thread'
                                    ? '🤖 AIスレッドを共有しました'
                                    : replyTo.kind === 'attachment'
                                        ? '📎 添付ファイル'
                                        : replyTo.content || 'メッセージ'}
                            </p>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="btn-icon p-1.5 text-surface-500"
                            aria-label="返信をキャンセル"
                        >
                            ✕
                        </button>
                    </div>
                )}
                {pendingAttachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                        {pendingAttachments.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-2 py-1 text-xs"
                            >
                                <span className="text-sm">
                                    {file.type.startsWith('image/') ? '🖼️' : '📎'}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate">{file.name}</p>
                                    <p className="text-surface-500">{formatFileSize(file.size)}</p>
                                </div>
                                <button
                                    onClick={() => handleRemovePendingAttachment(index)}
                                    className="btn-ghost text-xs px-2 py-1"
                                >
                                    削除
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {attachmentError && (
                    <div className="mb-2 text-xs text-error-600 dark:text-error-400">
                        {attachmentError}
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />
                    <button
                        onClick={handleAttachClick}
                        className="btn-secondary p-2.5 rounded-full flex-shrink-0"
                        type="button"
                    >
                        <PaperClipIcon className="w-5 h-5" />
                    </button>
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
                        disabled={(!input.trim() && pendingAttachments.length === 0) || sending}
                        className="btn-primary p-2.5 rounded-full flex-shrink-0"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
