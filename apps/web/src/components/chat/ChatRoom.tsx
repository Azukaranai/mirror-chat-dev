'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials, formatMessageTime, formatDateDivider, parseSharedAIThreadCard, cn } from '@/lib/utils';
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

const PhotoIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

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
    reply_to_message_id?: string | null;
    attachments?: AttachmentItem[];
    sharedCard?: ReturnType<typeof parseSharedAIThreadCard>;
}

interface RoomInfo {
    name: string;
    avatar_path: string | null;
    type: 'dm' | 'group';
    handle?: string | null;
}

interface ChatRoomProps {
    roomId: string;
    userId: string;
}

export function ChatRoom({ roomId, userId }: ChatRoomProps) {
    const [supabase, setSupabase] = useState<any>(null);
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
    const [sendError, setSendError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const [threadPickerOpen, setThreadPickerOpen] = useState(false);
    const [availableThreads, setAvailableThreads] = useState<any[]>([]);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [actionMenuMessageId, setActionMenuMessageId] = useState<string | null>(null);
    const [actionMenuStyles, setActionMenuStyles] = useState<React.CSSProperties>({});
    const [roomMenuOpen, setRoomMenuOpen] = useState(false);
    const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);
    // In-chat search
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]); // message IDs
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [threadStatus, setThreadStatus] = useState<
        Record<
            string,
            {
                exists: boolean;
                archived: boolean;
                createdAt?: string;
                owner?: { userId: string; displayName: string; avatarPath: string | null };
                model?: string;
            }
        >
    >({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const channelRef = useRef<any>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef(0);
    const messagesRef = useRef<Message[]>([]);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);

    // Initialize Supabase client on mount
    useEffect(() => {
        setSupabase(getSupabaseClient());
    }, []);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);



    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollToBottom(!isNearBottom);
    };

    // Delete/Unsend message
    const handleDeleteMessage = async (messageId: string) => {
        if (!supabase) return;
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);

        if (!error) {
            setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        }
        setActionMenuMessageId(null);
    };

    // Hide room (set hidden_at)
    const handleHideRoom = async () => {
        if (!supabase) return;
        await (supabase
            .from('room_members') as any)
            .update({ hidden_at: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', userId);

        router.push('/talk');
    };

    // Leave/Delete room
    const handleLeaveRoom = async () => {
        if (!supabase) return;
        // For DM, we just hide it. For groups, we leave.
        if (roomInfo?.type === 'dm') {
            await handleHideRoom();
        } else {
            // Leave the group room
            await (supabase
                .from('room_members') as any)
                .delete()
                .eq('room_id', roomId)
                .eq('user_id', userId);

            router.push('/talk');
        }
        setConfirmDeleteRoom(false);
        setRoomMenuOpen(false);
    };

    // Scroll to bottom
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const scroll = () => {
            const container = scrollContainerRef.current;
            if (!container) return;

            if (behavior === 'auto') {
                container.scrollTop = container.scrollHeight;
            } else {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
        };

        requestAnimationFrame(() => {
            scroll();
            if (behavior === 'auto') {
                // Retry multiple times for mobile rendering delays
                setTimeout(scroll, 100);
                setTimeout(scroll, 300);
                setTimeout(scroll, 500);
            }
        });
    }, []);

    // Adjust scroll when visual viewport changes (e.g. mobile keyboard opens)
    useEffect(() => {
        if (!isMobile) return;
        const handleResize = () => {
            scrollToBottom('auto');
        };
        // Use visualViewport if available as it reflects the actual visible area minus keyboard
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            return () => window.visualViewport?.removeEventListener('resize', handleResize);
        }
    }, [isMobile, scrollToBottom]);

    const formatFileSize = (size: number) => {
        if (size < 1024) return `${size}B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    };

    const fetchAttachments = useCallback(
        async (messageId: string) => {
            if (!supabase) return;
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
            if (!supabase) return;
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
        if (!supabase) return;

        const fetchData = async () => {
            setLoading(true);
            setLoadError(null);

            const { data: me } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .single();
            setCurrentUserName((me as any)?.display_name || null);

            // Clear hidden_at so this room appears in the list again
            await (supabase
                .from('room_members') as any)
                .update({ hidden_at: null })
                .eq('room_id', roomId)
                .eq('user_id', userId);

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
                    .select('user_id')
                    .eq('room_id', roomId)
                    .neq('user_id', userId)
                    .single();

                if (otherMember && (otherMember as any).user_id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name, avatar_path, handle')
                        .eq('user_id', (otherMember as any).user_id)
                        .single();

                    let displayName = (profile as any)?.display_name || (profile as any)?.handle || 'Unknown';
                    const handle = (profile as any)?.handle || null;
                    avatarPath = (profile as any)?.avatar_path || null;

                    // Try to fetch nickname
                    try {
                        const { data: friendship } = await supabase
                            .from('friendships')
                            .select('requester_id, requester_nickname, addressee_nickname')
                            .or(`and(requester_id.eq.${userId},addressee_id.eq.${(otherMember as any).user_id}),and(requester_id.eq.${(otherMember as any).user_id},addressee_id.eq.${userId})`)
                            .maybeSingle();

                        if (friendship) {
                            if (friendship.requester_id === userId && friendship.requester_nickname) {
                                displayName = friendship.requester_nickname;
                            } else if (friendship.requester_id !== userId && friendship.addressee_nickname) {
                                displayName = friendship.addressee_nickname;
                            }
                        }
                    } catch (e) {
                        // Ignore error if columns don't exist yet
                        console.warn('Failed to fetch nickname', e);
                    }

                    name = displayName;
                    setRoomInfo({
                        name,
                        avatar_path: avatarPath,
                        type: (room as any).type,
                        handle,
                    });
                } else {
                    setRoomInfo({ name, avatar_path: avatarPath, type: (room as any).type });
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

            if ((room as any).type !== 'dm') {
                setRoomInfo({ name, avatar_path: avatarPath, type: (room as any).type });
            }

            // Get messages
            const { data: msgs, error: msgsError } = await supabase
                .from('messages')
                .select(`
          id,
          content,
          kind,
          reply_to_message_id,
          sender_user_id,
          created_at,
          message_attachments(id, bucket, object_path, mime, size),
        `)
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            let messageRows = msgs as any[] | null;

            if (msgsError || !messageRows) {
                setLoadError('メッセージの取得に失敗しました');
                setLoading(false);
                return;
            }

            // Get unique sender IDs
            const senderIds = Array.from(new Set(messageRows.map((m) => m.sender_user_id)));
            const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_path')
                .in('user_id', senderIds);

            // Fetch nicknames for senders
            let nicknames: Record<string, string> = {};
            try {
                // Fetch all my friendships to resolve nicknames
                const { data: myFriendships } = await supabase
                    .from('friendships')
                    .select('requester_id, addressee_id, requester_nickname, addressee_nickname')
                    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

                if (myFriendships && myFriendships.length > 0) {
                    myFriendships.forEach((f: any) => {
                        const isRequester = f.requester_id === userId;
                        const partnerId = isRequester ? f.addressee_id : f.requester_id;
                        const nickname = isRequester ? f.requester_nickname : f.addressee_nickname;
                        if (nickname) {
                            nicknames[partnerId] = nickname;
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch nicknames', e);
            }

            const formattedMessages: Message[] = messageRows.map((msg) => {
                const sender = profiles?.find((p: any) => p.user_id === msg.sender_user_id);
                const displayName = nicknames[msg.sender_user_id] || (sender as any)?.display_name || 'Unknown';

                return {
                    id: msg.id,
                    content: msg.content,
                    kind: msg.kind,
                    sender_user_id: msg.sender_user_id,
                    sender_name: displayName,
                    sender_avatar: (sender as any)?.avatar_path,
                    created_at: msg.created_at,
                    is_mine: msg.sender_user_id === userId,
                    reply_to_message_id: msg.reply_to_message_id,
                    attachments: (msg.message_attachments || []) as AttachmentItem[],
                    sharedCard: msg.kind === 'shared_ai_thread'
                        ? parseSharedAIThreadCard(msg.content)
                        : null,
                };
            });
            setMessages(formattedMessages);

            // Update last read
            if (messageRows.length > 0) {
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: messageRows[messageRows.length - 1].id })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
            }

            setLoading(false);
        };

        fetchData();

        // Channel for Broadcast (Typing indicators) AND postgres_changes (DELETE events)
        const channel = supabase.channel(`room_events_${roomId}`);

        // Listen for typing events
        channel.on(
            'broadcast',
            { event: 'typing' },
            (payload: any) => {
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

        // Listen for message INSERT events
        channel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            },
            async (payload: any) => {
                const newMsg = payload.new;
                if (!newMsg?.id) return;

                // Check if we already have this message
                if (messagesRef.current.some((msg) => msg.id === newMsg.id)) {
                    return;
                }

                // Fetch full details
                const { data: fetchedMsg, error } = await supabase
                    .from('messages')
                    .select(`
                        id,
                        content,
                        kind,
                        reply_to_message_id,
                        sender_user_id,
                        created_at,
                        message_attachments(id, bucket, object_path, mime, size)
                    `)
                    .eq('id', newMsg.id)
                    .single();

                if (error || !fetchedMsg) return;

                const msgData = fetchedMsg as any;

                // Get sender info
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('display_name, avatar_path')
                    .eq('user_id', msgData.sender_user_id)
                    .single();

                const formattedMsg: Message = {
                    id: msgData.id,
                    content: msgData.content,
                    kind: msgData.kind,
                    reply_to_message_id: msgData.reply_to_message_id,
                    sender_user_id: msgData.sender_user_id,
                    sender_name: (sender as any)?.display_name || 'Unknown',
                    sender_avatar: (sender as any)?.avatar_path,
                    created_at: msgData.created_at,
                    is_mine: msgData.sender_user_id === userId,
                    attachments: (msgData.message_attachments || []) as AttachmentItem[],
                    sharedCard: msgData.kind === 'shared_ai_thread'
                        ? parseSharedAIThreadCard(msgData.content)
                        : null,
                };

                setMessages((prev) => {
                    if (prev.some(m => m.id === formattedMsg.id)) return prev;
                    return [...prev, formattedMsg];
                });

                // Update last read
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: msgData.id })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
            }
        );

        // Listen for message DELETE events (for real-time deletion sync)
        channel.on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            },
            (payload: any) => {
                const deletedId = (payload.old as any)?.id;
                if (deletedId) {
                    setMessages((prev) => prev.filter((msg) => msg.id !== deletedId));
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
    }, [supabase, roomId, userId, addTypingUser, removeTypingUser, setTypingUsers]);

    // Listen for new message signals from RoomList (via ChatStore)
    const newMessageSignal = useChatStore((state) => state.newMessageSignal);

    useEffect(() => {
        if (!newMessageSignal) return;
        if (newMessageSignal.roomId !== roomId) return;

        const messageId = newMessageSignal.messageId;

        // Check if we already have this message
        if (messagesRef.current.some((msg) => msg.id === messageId)) {
            return;
        }

        // Fetch the new message details
        const fetchNewMessage = async () => {
            const { data: fetchedMsg, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    content,
                    kind,
                    reply_to_message_id,
                    sender_user_id,
                    created_at,
                    message_attachments(id, bucket, object_path, mime, size)
                `)
                .eq('id', messageId)
                .single();

            if (error || !fetchedMsg) {
                console.error('Failed to fetch new message details', error);
                return;
            }
            const msgData = fetchedMsg as any;

            // Get sender info
            const { data: sender } = await supabase
                .from('profiles')
                .select('display_name, avatar_path')
                .eq('user_id', msgData.sender_user_id)
                .single();

            const formattedMsg: Message = {
                id: msgData.id,
                content: msgData.content,
                kind: msgData.kind,
                reply_to_message_id: msgData.reply_to_message_id,
                sender_user_id: msgData.sender_user_id,
                sender_name: (sender as any)?.display_name || 'Unknown',
                sender_avatar: (sender as any)?.avatar_path,
                created_at: msgData.created_at,
                is_mine: msgData.sender_user_id === userId,
                attachments: (msgData.message_attachments || []) as AttachmentItem[],
                sharedCard: msgData.kind === 'shared_ai_thread'
                    ? parseSharedAIThreadCard(msgData.content)
                    : null,
            };

            setMessages((prev) => {
                if (prev.some(m => m.id === formattedMsg.id)) return prev;
                return [...prev, formattedMsg];
            });

            // Update last read
            await (supabase
                .from('room_members') as any)
                .update({ last_read_message_id: msgData.id })
                .eq('room_id', roomId)
                .eq('user_id', userId);
        };

        fetchNewMessage();
    }, [newMessageSignal, roomId, supabase, userId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone.current) {
                scrollToBottom('auto');
                initialScrollDone.current = true;
            } else {
                scrollToBottom('smooth');
            }
        }
    }, [messages, scrollToBottom]);

    // Check availability and details of shared threads
    useEffect(() => {
        const checkThreads = async () => {
            const threadIds = messages
                .filter((m) => m.kind === 'shared_ai_thread' && m.sharedCard)
                .map((m) => m.sharedCard!.threadId);

            const uniqueIds = Array.from(new Set(threadIds)).filter(
                (id) => !(id in threadStatus)
            );
            if (uniqueIds.length === 0) return;

            const { data: threads } = await supabase
                .from('ai_threads')
                .select('id, archived_at, created_at, owner_user_id, model')
                .in('id', uniqueIds);

            if (!threads) return;

            // Fetch owners
            const ownerIds = Array.from(new Set(threads.map((t: any) => t.owner_user_id)));
            const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_path, handle')
                .in('user_id', ownerIds);

            setThreadStatus((prev) => {
                const next = { ...prev };
                uniqueIds.forEach((id) => {
                    const found = threads.find((t: any) => t.id === id);
                    if (found) {
                        const owner = profiles?.find((p: any) => p.user_id === found.owner_user_id);
                        next[id] = {
                            exists: true,
                            archived: !!found.archived_at,
                            createdAt: found.created_at,
                            model: found.model,
                            owner: owner
                                ? {
                                    userId: owner.user_id,
                                    displayName: owner.display_name || owner.handle || 'Unknown',
                                    avatarPath: owner.avatar_path,
                                }
                                : undefined,
                        };
                    } else {
                        // If not found, it might be RLS restricted (shared from others).
                        // Instead of marking as deleted, assume it exists.
                        next[id] = { exists: true, archived: false };
                    }
                });
                return next;
            });
        };

        if (messages.length > 0) {
            checkThreads();
        }
    }, [messages, supabase]);

    // Fetch threads for picker
    const fetchThreadsForPicker = async () => {
        const { data } = await supabase
            .from('ai_threads')
            .select('id, title, model, updated_at, created_at')
            .eq('owner_user_id', userId)
            .is('archived_at', null)
            .order('updated_at', { ascending: false })
            .limit(20);

        if (data) {
            setAvailableThreads(data);
        }
    };

    // Send message
    const handleSend = async () => {
        if (!supabase) return;
        if ((!input.trim() && pendingAttachments.length === 0) || sending) return;

        const content = input.trim();
        const attachmentsSnapshot = [...pendingAttachments];
        const replySnapshot = replyTo;
        stopTyping();
        setInput('');
        setPendingAttachments([]);
        setReplyTo(null);
        setAttachmentError(null);
        setSendError(null);
        setSending(true);

        try {
            const createMessage = async () => {
                const { data: inserted, error: insertError } = await supabase
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
                return { inserted, insertError };
            };

            let { inserted: newMessage, insertError: messageError } = await createMessage();

            if (messageError && messageError.message?.toLowerCase().includes('row level security')) {
                const { error: joinError } = await supabase.from('room_members').insert([
                    { room_id: roomId, user_id: userId },
                ] as any);
                if (!joinError) {
                    const retry = await createMessage();
                    newMessage = retry.inserted;
                    messageError = retry.insertError as any;
                }
            }

            if (messageError || !newMessage) {
                setSendError(messageError?.message || 'メッセージ送信に失敗しました');
                throw messageError || new Error('Failed to create message');
            }

            const optimisticMessage: Message = {
                id: newMessage.id,
                content: content || null,
                kind: attachmentsSnapshot.length > 0 ? 'attachment' : 'text',
                reply_to_message_id: replySnapshot?.id ?? null,
                sender_user_id: userId,
                sender_name: currentUserName || 'You',
                sender_avatar: null,
                created_at: new Date().toISOString(),
                is_mine: true,
                attachments: [],
                sharedCard: null,
            };

            setMessages((prev) =>
                prev.some((msg) => msg.id === optimisticMessage.id) ? prev : [...prev, optimisticMessage]
            );

            await (supabase
                .from('room_members') as any)
                .update({ last_read_message_id: newMessage.id })
                .eq('room_id', roomId)
                .eq('user_id', userId);

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!supabase || sending) return;

        // On mobile, Enter should just insert a newline (default behavior)
        // On desktop, Enter sends, Shift+Enter newlines
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (value: string) => {
        setInput(value);

        // Auto-resize textarea
        if (inputRef.current) {
            inputRef.current.style.height = '38px'; // Reset to min height
            const scrollHeight = inputRef.current.scrollHeight;
            inputRef.current.style.height = Math.min(scrollHeight, 128) + 'px'; // Max 128px
        }

        if (attachmentError) {
            setAttachmentError(null);
        }
        if (sendError) {
            setSendError(null);
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

    const handleSendThread = async (thread: any) => {
        setThreadPickerOpen(false);
        setAttachMenuOpen(false);

        // Send thread card message
        const content = JSON.stringify({
            threadId: thread.id,
            ownerUserId: userId,
            titleSnapshot: thread.title,
            modelSnapshot: thread.model,
            createdAtSnapshot: thread.created_at
        });

        const { data: inserted, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                sender_user_id: userId,
                kind: 'shared_ai_thread',
                content: content,
            } as any)
            .select('id')
            .single();

        if (!error && inserted) {
            // Grant view access to other room members
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id')
                .eq('room_id', roomId)
                .neq('user_id', userId);

            if (members && members.length > 0) {
                const threadMembers = members.map((m: { user_id: string }) => ({
                    thread_id: thread.id,
                    user_id: m.user_id,
                    permission: 'VIEW'
                }));

                await supabase
                    .from('ai_thread_members')
                    .upsert(threadMembers as any, { onConflict: 'thread_id,user_id', ignoreDuplicates: true });
            }

            await (supabase
                .from('room_members') as any)
                .update({ last_read_message_id: (inserted as any).id })
                .eq('room_id', roomId)
                .eq('user_id', userId);
        }
    };

    const handleAttachClick = () => {
        setAttachMenuOpen(!attachMenuOpen);
    };

    const handleFileOption = () => {
        setAttachMenuOpen(false);
        fileInputRef.current?.click();
    };

    const handleThreadOption = () => {
        setThreadPickerOpen(true);
        fetchThreadsForPicker();
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
            <div className="h-full w-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
                <Link href="/talk" className="md:hidden btn-icon">
                    <ArrowLeftIcon className="w-5 h-5" />
                </Link>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                    {roomInfo?.handle === 'mirror' || roomInfo?.name === 'Mirror' ? (
                        <Image
                            src="/app-icon.svg"
                            alt="Mirror"
                            width={40}
                            height={40}
                            className="w-full h-full object-cover bg-white"
                        />
                    ) : roomInfo?.avatar_path ? (
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

                {/* Search button */}
                <button
                    onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setSearchQuery(''); }}
                    className={cn('btn-icon p-2', searchOpen && 'bg-primary-100 dark:bg-primary-900/30 text-primary-600')}
                    aria-label="検索"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                </button>

                {/* Room menu */}
                <div className="relative">
                    <button
                        onClick={() => setRoomMenuOpen(!roomMenuOpen)}
                        className="btn-icon p-2"
                        aria-label="メニュー"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                    </button>
                    {roomMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setRoomMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => { setRoomMenuOpen(false); handleHideRoom(); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                >
                                    <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                    <span className="text-sm font-medium">非表示にする</span>
                                </button>
                                <button
                                    onClick={() => { setRoomMenuOpen(false); setConfirmDeleteRoom(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors text-left text-error-600 dark:text-error-400"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                    <span className="text-sm font-medium">{roomInfo?.type === 'dm' ? '削除する' : '退出する'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* In-chat Search Bar */}
            {searchOpen && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            const query = e.target.value;
                            setSearchQuery(query);
                            if (query.trim()) {
                                const matchedIds = messages
                                    .filter((m) => m.content && m.content.toLowerCase().includes(query.toLowerCase()))
                                    .map((m) => m.id);
                                setSearchResults(matchedIds);
                                setCurrentSearchIndex(matchedIds.length > 0 ? matchedIds.length - 1 : 0);
                                if (matchedIds.length > 0) {
                                    scrollToMessage(matchedIds[matchedIds.length - 1]);
                                }
                            } else {
                                setSearchResults([]);
                                setCurrentSearchIndex(0);
                            }
                        }}
                        placeholder="メッセージを検索..."
                        className="flex-1 text-sm py-1.5 px-3 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        autoFocus
                    />
                    {searchResults.length > 0 && (
                        <span className="text-xs text-surface-500 whitespace-nowrap">
                            {currentSearchIndex + 1} / {searchResults.length}
                        </span>
                    )}
                    <button
                        onClick={() => {
                            if (searchResults.length === 0) return;
                            const prevIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
                            setCurrentSearchIndex(prevIndex);
                            scrollToMessage(searchResults[prevIndex]);
                        }}
                        disabled={searchResults.length === 0}
                        className="btn-icon p-1.5 disabled:opacity-30"
                        aria-label="前の結果"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                    </button>
                    <button
                        onClick={() => {
                            if (searchResults.length === 0) return;
                            const nextIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
                            setCurrentSearchIndex(nextIndex);
                            scrollToMessage(searchResults[nextIndex]);
                        }}
                        disabled={searchResults.length === 0}
                        className="btn-icon p-1.5 disabled:opacity-30"
                        aria-label="次の結果"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                    <button
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
                        className="btn-icon p-1.5"
                        aria-label="閉じる"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDeleteRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDeleteRoom(false)}>
                    <div className="w-full max-w-sm bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">
                                {roomInfo?.type === 'dm' ? 'トークを削除しますか？' : 'グループを退出しますか？'}
                            </h3>
                            <p className="text-sm text-surface-500 mb-6">
                                {roomInfo?.type === 'dm'
                                    ? 'このトークは非表示になります。新しいメッセージが届くと再表示されます。'
                                    : 'グループから退出すると、メッセージ履歴にアクセスできなくなります。'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDeleteRoom(false)}
                                    className="flex-1 btn-secondary py-2.5"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleLeaveRoom}
                                    className="flex-1 bg-error-600 hover:bg-error-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                                >
                                    {roomInfo?.type === 'dm' ? '削除' : '退出'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto px-4 pt-4 pb-20 space-y-4 chat-bg"
            >
                {loadError && (
                    <div className="rounded-lg border border-error-200/60 bg-error-50/80 px-3 py-2 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-950/40 dark:text-error-300">
                        {loadError}
                    </div>
                )}
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
                                    className={`flex w-full ${msg.is_mine ? 'justify-end' : 'justify-start'} mb-2 overflow-visible group`}
                                >
                                    {/* Avatar for group messages */}
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
                                            ) : msg.sender_name === 'Mirror' ? (
                                                <Image
                                                    src="/app-icon.svg"
                                                    alt="Mirror"
                                                    width={32}
                                                    height={32}
                                                    className="w-full h-full object-cover bg-white"
                                                />
                                            ) : (
                                                <span className="text-white text-xs font-bold">
                                                    {getInitials(msg.sender_name)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className={`flex flex-col ${msg.is_mine ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[75%]`}>
                                        {!msg.is_mine && roomInfo?.type === 'group' && (
                                            <p className="text-xs text-surface-500 mb-1">{msg.sender_name}</p>
                                        )}
                                        {/* Message row with action button */}
                                        <div className={`flex items-start gap-1 ${msg.is_mine ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {/* Message Bubble */}
                                            <div
                                                className={cn(
                                                    "relative px-3 py-2 shadow-sm text-sm md:text-base break-words",
                                                    msg.is_mine
                                                        ? "bg-primary-500 text-white rounded-2xl rounded-tr-sm"
                                                        : "bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-2xl rounded-tl-sm"
                                                )}
                                            >
                                                {replyTarget && (
                                                    <button
                                                        onClick={() => scrollToMessage(replyTarget.id)}
                                                        className={cn(
                                                            "w-full text-left text-xs rounded-md border-l-2 px-2 py-1 mb-2 overflow-hidden",
                                                            msg.is_mine
                                                                ? "border-white/60 bg-black/10 text-white/90"
                                                                : "border-primary-500 bg-surface-100 dark:bg-surface-900/50 text-surface-600 dark:text-surface-300"
                                                        )}
                                                    >
                                                        <p className="font-medium truncate text-[10px] opacity-80">
                                                            {replyTarget.sender_name}
                                                        </p>
                                                        <p className="truncate opacity-80">
                                                            {replyTarget.kind === 'shared_ai_thread'
                                                                ? '🤖 AIスレッドを共有しました'
                                                                : replyTarget.kind === 'attachment'
                                                                    ? '📎 添付ファイル'
                                                                    : replyTarget.content || 'メッセージ'}
                                                        </p>
                                                    </button>
                                                )}

                                                {msg.kind === 'shared_ai_thread' && sharedCard ? (
                                                    <div
                                                        className={cn(
                                                            'rounded-xl border p-3 min-w-[240px]',
                                                            threadStatus[sharedCard.threadId] &&
                                                                !threadStatus[sharedCard.threadId].exists
                                                                ? 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 opacity-75'
                                                                : 'border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-900/80'
                                                        )}
                                                    >
                                                        <div className="flex items-start gap-3 mb-2">
                                                            <div
                                                                className={cn(
                                                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5',
                                                                    threadStatus[sharedCard.threadId] &&
                                                                        !threadStatus[sharedCard.threadId].exists
                                                                        ? 'bg-surface-300 dark:bg-surface-700'
                                                                        : 'bg-gradient-to-br from-accent-400 to-primary-400'
                                                                )}
                                                            >
                                                                <SparklesIcon className="w-4 h-4 text-white" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <p className="text-[10px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-wider">
                                                                        AI Thread
                                                                    </p>
                                                                    {threadStatus[sharedCard.threadId] && (
                                                                        <span
                                                                            className={cn(
                                                                                'text-[10px] font-bold px-1.5 py-0 rounded-full',
                                                                                !threadStatus[sharedCard.threadId].exists
                                                                                    ? 'bg-surface-200 text-surface-600'
                                                                                    : threadStatus[sharedCard.threadId].archived
                                                                                        ? 'bg-warning-100 text-warning-700'
                                                                                        : 'hidden'
                                                                            )}
                                                                        >
                                                                            {!threadStatus[sharedCard.threadId].exists
                                                                                ? '削除済'
                                                                                : 'アーカイブ'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="font-bold text-sm leading-tight text-surface-900 dark:text-surface-100 line-clamp-2">
                                                                    {sharedCard.titleSnapshot || '名称未設定のスレッド'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Metadata Row */}
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 textxs text-surface-500 mb-3 px-1 text-[10px]">
                                                            <span className="font-medium bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">
                                                                {(threadStatus[sharedCard.threadId]?.model || sharedCard.modelSnapshot)?.replace('gpt-', 'GPT-').replace('gemini-', 'Gemini ')}
                                                            </span>

                                                            {(threadStatus[sharedCard.threadId]?.createdAt || sharedCard.createdAtSnapshot) && (
                                                                <>
                                                                    <span className="text-surface-300 dark:text-surface-600">•</span>
                                                                    <span className="font-mono opacity-80">
                                                                        {new Date(
                                                                            threadStatus[sharedCard.threadId]?.createdAt ||
                                                                            sharedCard.createdAtSnapshot!
                                                                        ).toLocaleDateString('ja-JP')}
                                                                    </span>
                                                                </>
                                                            )}

                                                            {(() => {
                                                                const owner = threadStatus[sharedCard.threadId]?.owner || {
                                                                    userId: msg.sender_user_id,
                                                                    displayName: msg.sender_name,
                                                                    avatarPath: msg.sender_avatar
                                                                };
                                                                return (
                                                                    <>
                                                                        <span className="text-surface-300 dark:text-surface-600">•</span>
                                                                        <div className="flex items-center gap-1 min-w-0">
                                                                            {owner.avatarPath ? (
                                                                                <div className="w-3.5 h-3.5 rounded-full overflow-hidden ring-1 ring-surface-200 dark:ring-surface-700 relative">
                                                                                    <img
                                                                                        src={getStorageUrl('avatars', owner.avatarPath)}
                                                                                        alt=""
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="w-3.5 h-3.5 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-[6px] font-bold text-surface-600 dark:text-surface-300 uppercase">
                                                                                    {getInitials(owner.displayName)}
                                                                                </div>
                                                                            )}
                                                                            <span className="truncate max-w-[80px]">
                                                                                {owner.displayName}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>

                                                        {(!threadStatus[sharedCard.threadId] ||
                                                            threadStatus[sharedCard.threadId].exists) && (
                                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(`/ai/${sharedCard.threadId}`);
                                                                        }}
                                                                        className="flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                                        title="ページ移動"
                                                                    >
                                                                        移動
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            addSplitTab(
                                                                                sharedCard.threadId,
                                                                                sharedCard.titleSnapshot || 'AIスレッド'
                                                                            );
                                                                        }}
                                                                        className="flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                                        title="分割ビューで開く"
                                                                    >
                                                                        分割
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            openWindow(sharedCard.threadId);
                                                                        }}
                                                                        className="hidden md:flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                                        title="オーバーレイで開く"
                                                                    >
                                                                        窓
                                                                    </button>
                                                                </div>
                                                            )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {msg.content && (
                                                            <p className="whitespace-pre-wrap break-words max-w-full">
                                                                {msg.content}
                                                            </p>
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
                                                <div
                                                    className={cn(
                                                        "text-[10px] mt-1 flex justify-end select-none",
                                                        msg.is_mine ? "text-white/70" : "text-surface-400"
                                                    )}
                                                >
                                                    {formatMessageTime(msg.created_at)}
                                                </div>
                                            </div>

                                            {/* Action button - beside message, aligned to top */}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const isMine = msg.is_mine;
                                                            setActionMenuStyles({
                                                                position: 'fixed',
                                                                top: rect.bottom + 4,
                                                                [isMine ? 'right' : 'left']: isMine ? window.innerWidth - rect.right : rect.left,
                                                            });
                                                            setActionMenuMessageId(actionMenuMessageId === msg.id ? null : msg.id);
                                                        }}
                                                        className="p-1 rounded-full text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                                        title="メニュー"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                                        </svg>
                                                    </button>
                                                </div>
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

            {/* Thread Picker Modal */}
            {threadPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setThreadPickerOpen(false)}>
                    <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                            <h3 className="font-semibold">AIスレッドを選択</h3>
                            <button onClick={() => setThreadPickerOpen(false)} className="btn-icon">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {availableThreads.length > 0 ? (
                                availableThreads.map(thread => (
                                    <button
                                        key={thread.id}
                                        onClick={() => handleSendThread(thread)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center flex-shrink-0">
                                            <SparklesIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{thread.title}</p>
                                            <p className="text-xs text-surface-500">{thread.model}</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center text-surface-500">
                                    スレッドが見つかりません
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Input - Floating design */}
            <div className="absolute bottom-4 left-0 right-0 px-4 safe-bottom z-20">
                {showScrollToBottom && (
                    <button
                        onClick={() => scrollToBottom()}
                        className="absolute bottom-full right-4 mb-4 grid place-items-center w-10 h-10 bg-white dark:bg-surface-800 rounded-full shadow-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all animate-in fade-in zoom-in duration-200"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                )}
                {/* Action menu used to be here */}
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
                {sendError && (
                    <div className="mb-2 text-xs text-error-600 dark:text-error-400">
                        {sendError}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />

                    <div className="relative self-center">
                        {attachMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-20 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <button
                                        onClick={handleFileOption}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                    >
                                        <PhotoIcon className="w-5 h-5 text-primary-500" />
                                        <span className="text-sm font-medium">画像・ファイル</span>
                                    </button>
                                    <button
                                        onClick={handleThreadOption}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                    >
                                        <SparklesIcon className="w-5 h-5 text-accent-500" />
                                        <span className="text-sm font-medium">AIスレッド</span>
                                    </button>
                                </div>
                            </>
                        )}
                        <button
                            onClick={handleAttachClick}
                            className={cn(
                                "w-[38px] h-[38px] flex items-center justify-center rounded-full flex-shrink-0 transition-all shadow-lg",
                                "bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700",
                                "border border-surface-200/50 dark:border-surface-700/50",
                                attachMenuOpen && "rotate-45"
                            )}
                            type="button"
                        >
                            <PaperClipIcon className="w-4 h-4 text-surface-600 dark:text-surface-400" />
                        </button>
                    </div>

                    <div className="flex-1 flex items-center">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => { if (isMobile) setTimeout(() => scrollToBottom('auto'), 300); }}
                            onBlur={stopTyping}
                            placeholder="メッセージを入力..."
                            rows={1}
                            style={{ minHeight: '38px', height: '38px' }}
                            className="w-full resize-none rounded-[19px] border border-surface-200/50 dark:border-surface-700/50 bg-white dark:bg-surface-800 px-4 py-[9px] text-sm leading-5 max-h-32 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 placeholder:text-surface-400 transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={(!input.trim() && pendingAttachments.length === 0) || sending}
                        className={cn(
                            "w-[38px] h-[38px] flex items-center justify-center rounded-full flex-shrink-0 transition-all shadow-lg",
                            "bg-primary-500 hover:bg-primary-600 text-white",
                            "disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:text-white/80 disabled:cursor-not-allowed"
                        )}
                    >
                        <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Global Message Action Menu */}
            {actionMenuMessageId && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setActionMenuMessageId(null)} />
                    <div style={actionMenuStyles} className="fixed w-28 bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-[101] animate-in fade-in slide-in-from-top-2 duration-150">
                        {(() => {
                            const msg = messages.find(m => m.id === actionMenuMessageId);
                            if (!msg) return null;
                            return (
                                <>
                                    <button
                                        onClick={() => { setReplyTo(msg); setActionMenuMessageId(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                    >
                                        <div className="w-4 h-4 text-surface-400">
                                            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                            </svg>
                                        </div>
                                        <span className="text-xs font-medium">返信</span>
                                    </button>
                                    <button
                                        onClick={() => { handleDeleteMessage(msg.id); setActionMenuMessageId(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors text-left text-error-600 dark:text-error-400"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                        <span className="text-xs font-medium">{msg.is_mine ? '取消' : '削除'}</span>
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </>
            )}
        </div>
    );
}
