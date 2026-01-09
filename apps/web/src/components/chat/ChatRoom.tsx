'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
    const [sendError, setSendError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const [threadPickerOpen, setThreadPickerOpen] = useState(false);
    const [availableThreads, setAvailableThreads] = useState<any[]>([]);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
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
            setLoadError(null);

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
                    name = (profile as any)?.display_name || (profile as any)?.handle || 'Unknown';
                    avatarPath = (profile as any)?.avatar_path || null;
                    setRoomInfo({
                        name,
                        avatar_path: avatarPath,
                        type: (room as any).type,
                        handle: (profile as any)?.handle || null,
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
            if (msgsError) {
                const fallback = await supabase
                    .from('messages')
                    .select('id, content, kind, reply_to_message_id, sender_user_id, created_at')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true });
                if (fallback.error) {
                    setLoadError(fallback.error.message || 'メッセージの取得に失敗しました');
                    setLoading(false);
                    return;
                }
                messageRows = fallback.data as any[] | null;
            }

            if (messageRows) {
                const senderIds = Array.from(
                    new Set(
                        (messageRows as any[])
                            .map((m) => m.sender_user_id as string | null)
                            .filter((id): id is string => Boolean(id))
                    )
                );
                const profileMap = new Map<string, { display_name: string; avatar_path: string | null }>();
                if (senderIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('user_id, display_name, avatar_path, handle')
                        .in('user_id', senderIds);
                    (profiles as any[] | null)?.forEach((profile) => {
                        profileMap.set(profile.user_id, {
                            display_name: profile.display_name || profile.handle || 'Unknown',
                            avatar_path: profile.avatar_path,
                        });
                    });
                }

                const formattedMsgs: Message[] = messageRows.map((m: any) => {
                    const profile = profileMap.get(m.sender_user_id) || null;
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
                        sender_avatar: profile?.avatar_path || null,
                        created_at: m.created_at,
                        is_mine: m.sender_user_id === userId,
                        attachments: (m.message_attachments || []) as AttachmentItem[],
                        sharedCard,
                    };
                });
                setMessages(formattedMsgs);
            }

            // Update last read
            if (messageRows && messageRows.length > 0) {
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: (messageRows as any[])[(messageRows as any[]).length - 1].id })
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
                if (messagesRef.current.some((msg) => msg.id === newMsg.id)) {
                    return;
                }

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
    }, [supabase, roomId, userId, addTypingUser, removeTypingUser, setTypingUsers, fetchAttachments]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Fetch threads for picker
    const fetchThreadsForPicker = async () => {
        const { data } = await supabase
            .from('ai_threads')
            .select('id, title, model, updated_at')
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
            modelSnapshot: thread.model
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
        <div className="flex flex-col h-full">
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
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4 chat-bg">
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
                                    className={`flex w-full ${msg.is_mine ? 'justify-end' : 'justify-start'} mb-2 overflow-visible`}
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
                                    <div
                                        className={`flex-1 min-w-0 flex flex-col ${msg.is_mine ? 'items-end' : 'items-start'}`}
                                    >
                                        {!msg.is_mine && roomInfo?.type === 'group' && (
                                            <p className="text-xs text-surface-500 mb-1">{msg.sender_name}</p>
                                        )}
                                        <div
                                            className={cn(
                                                "relative px-3 py-2 shadow-sm max-w-[85%] md:max-w-[75%] text-sm md:text-base break-words",
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
                                                    <p className="font-medium truncate opacity-90">
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
                                                <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-900/80 p-3 min-w-[240px]">
                                                    <div className="flex items-center gap-2.5 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                            <SparklesIcon className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[10px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-wider">AI Thread</p>
                                                            <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{sharedCard.modelSnapshot}</p>
                                                        </div>
                                                    </div>

                                                    <p className="font-bold text-sm mb-3 line-clamp-2 text-surface-900 dark:text-surface-100">
                                                        {sharedCard.titleSnapshot || '名称未設定のスレッド'}
                                                    </p>

                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); router.push(`/ai/${sharedCard.threadId}`); }}
                                                            className="flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                            title="ページ移動"
                                                        >
                                                            移動
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); addSplitTab(sharedCard.threadId, sharedCard.titleSnapshot || 'AIスレッド'); }}
                                                            className="flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                            title="分割ビューで開く"
                                                        >
                                                            分割
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openWindow(sharedCard.threadId); }}
                                                            className="flex items-center justify-center px-1 py-1.5 rounded-md bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300 transition-colors"
                                                            title="オーバーレイで開く"
                                                        >
                                                            窓
                                                        </button>
                                                    </div>
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
                                        <div
                                            className={`mt-1 flex flex-wrap items-center gap-1 ${msg.is_mine ? 'justify-end pr-2' : 'justify-start pl-1'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setReplyTo(msg)}
                                                className="px-2 py-0.5 rounded-full text-xs border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900"
                                            >
                                                <ReplyIcon className="w-4 h-4" />
                                            </button>
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

            {/* Input */}
            <div className="relative border-t border-surface-200 dark:border-surface-800 p-3 bg-white dark:bg-surface-900 safe-bottom z-20">
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

                    <div className="relative">
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
                            className={cn("btn-secondary p-2.5 rounded-full flex-shrink-0 self-center transition-transform", attachMenuOpen && "rotate-45 bg-surface-200 dark:bg-surface-700")}
                            type="button"
                        >
                            <PaperClipIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={stopTyping}
                            placeholder="メッセージを入力..."
                            rows={1}
                            className="input resize-none py-2.5 min-h-[42px] max-h-32 leading-5"
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={(!input.trim() && pendingAttachments.length === 0) || sending}
                        className="btn-primary p-2.5 rounded-full flex-shrink-0 self-center"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
