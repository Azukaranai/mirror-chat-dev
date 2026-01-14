'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials, formatMessageTime, formatDateDivider, parseSharedAIThreadCard, CHAT_CONTEXT_PREFIX, CHAT_CONTEXT_STATUS_PREFIX, cn } from '@/lib/utils';
import { useChatStore, useOverlayStore, useSplitStore } from '@/lib/stores';
import type { TypingPayload } from '@/types';
import { EditNicknameDialog } from '../profile/EditNicknameDialog';
import { ChatGroupSettings } from './ChatGroupSettings';

// Helper to format message content with links
// Helper to format message content with links
const formatMessageContent = (content: string, isMe: boolean = false, highlightQuery?: string) => {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    const trimmedQuery = highlightQuery?.trim();
    const hasQuery = Boolean(trimmedQuery);
    const queryLower = trimmedQuery?.toLowerCase() || '';
    const escapedQuery = trimmedQuery ? trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const highlightRegex = escapedQuery ? new RegExp(`(${escapedQuery})`, 'gi') : null;

    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={isMe ? "text-white underline decoration-white/50 hover:opacity-90 break-all" : "text-primary-500 hover:underline break-all"}
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        if (!hasQuery || !highlightRegex) return part;
        return part.split(highlightRegex).map((chunk, chunkIndex) => {
            if (chunk.toLowerCase() !== queryLower) return chunk;
            return (
                <mark
                    key={`${index}-${chunkIndex}`}
                    className="rounded px-0.5 bg-amber-300/70 text-surface-900 dark:bg-amber-400/40 dark:text-surface-100"
                >
                    {chunk}
                </mark>
            );
        });
    });
};

// Icons
const ArrowLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
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

const UserGroupIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 9.098 9.098 0 003.74.477m.94-3.197a5.971 5.971 0 00-.941-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
);

const UserPlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
);

const Cog6ToothIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l-.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.149-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
    friendId?: string;
    group_id?: string;
}

type GroupLogEvent = {
    type: 'group_event';
    action: 'settings_updated' | 'member_added' | 'member_removed' | 'member_left';
    actorId?: string;
    targetIds?: string[];
    targetId?: string;
    changes?: {
        name?: string;
        avatarUpdated?: boolean;
    };
};

interface ChatRoomProps {
    roomId: string;
    userId: string;
}

export function ChatRoom({ roomId, userId }: ChatRoomProps) {
    const [supabase, setSupabase] = useState<any>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const openWindow = useOverlayStore((state) => state.openWindow);
    const addSplitTab = useSplitStore((state) => state.addTab);
    const typingUsers = useChatStore((state) => state.typingUsers);
    const addTypingUser = useChatStore((state) => state.addTypingUser);
    const removeTypingUser = useChatStore((state) => state.removeTypingUser);
    const setTypingUsers = useChatStore((state) => state.setTypingUsers);
    const fetchNotifications = useChatStore((state) => state.fetchNotifications);
    const [messages, setMessages] = useState<Message[]>([]);
    const [systemNameMap, setSystemNameMap] = useState<Record<string, string>>({});
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
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
    const [threadPickerCreating, setThreadPickerCreating] = useState(false);
    const [threadPickerError, setThreadPickerError] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [actionMenuMessageId, setActionMenuMessageId] = useState<string | null>(null);
    const [actionMenuStyles, setActionMenuStyles] = useState<React.CSSProperties>({});
    const actionMenuContainerRef = useRef<HTMLDivElement | null>(null);
    const actionMenuAnchorRef = useRef<DOMRect | null>(null);
    const actionMenuAlignRef = useRef<'left' | 'right'>('left');
    const [portalReady, setPortalReady] = useState(false);
    const [roomMenuOpen, setRoomMenuOpen] = useState(false);
    const [roomMenuPosition, setRoomMenuPosition] = useState<{ top: number; left: number; visibility?: 'hidden' | 'visible' }>({
        top: 0,
        left: 0,
        visibility: 'hidden'
    });
    const roomMenuButtonRef = useRef<HTMLButtonElement | null>(null);
    const roomMenuContainerRef = useRef<HTMLDivElement | null>(null);
    const roomMenuAnchorRef = useRef<DOMRect | null>(null);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [groupSettingsInitialView, setGroupSettingsInitialView] = useState<'members' | 'invite' | 'settings'>('members');
    const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);
    const [confirmHideRoom, setConfirmHideRoom] = useState(false);
    // In-chat search
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]); // message IDs
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [showThreadReadManager, setShowThreadReadManager] = useState(false);
    const [threadStatus, setThreadStatus] = useState<
        Record<
            string,
            {
                exists: boolean;
                archived: boolean;
                createdAt?: string;
                owner?: { userId: string; displayName: string; avatarPath: string | null };
                model?: string;
                title?: string;
                ownerHasKey?: boolean | null;
                sourceRoomId?: string | null;
                readEnabled?: boolean | null;
            }
        >
    >({});
    const aiReadEnabledRef = useRef(false);
    const aiContextHandledRef = useRef<Set<string>>(new Set());
    const threadStatusRef = useRef(threadStatus);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const channelRef = useRef<any>(null);
    const threadLogChannelsRef = useRef<Record<string, any>>({});
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef(0);
    const messagesRef = useRef<Message[]>([]);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);
    const highlightMessageId = searchParams.get('highlight');
    const lastHighlightRef = useRef<string | null>(null);
    useEffect(() => {
        threadStatusRef.current = threadStatus;
    }, [threadStatus]);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    const getLatestSharedThreadCard = useCallback(() => {
        for (let i = messagesRef.current.length - 1; i >= 0; i -= 1) {
            const msg = messagesRef.current[i];
            if (msg.kind === 'shared_ai_thread' && msg.sharedCard?.threadId) {
                return msg.sharedCard;
            }
        }
        return null;
    }, []);

    const ensureAiThreadViewMember = useCallback(
        async (threadId: string) => {
            if (!supabase || !userId || !threadId) return;
            try {
                await (supabase
                    .from('ai_thread_members') as any)
                    .upsert(
                        {
                            thread_id: threadId,
                            user_id: userId,
                            permission: 'VIEW',
                        },
                        { onConflict: 'thread_id,user_id', ignoreDuplicates: true }
                    );
            } catch (err) {
                console.error('Failed to add AI thread viewer:', err);
            }
        },
        [supabase, userId]
    );

    // Ensure current user is a viewer of the shared AI thread (for RLS safety)
    const appendChatContextToThread = useCallback(
        async (msg: Message) => {
            if (!supabase) return;
            if (!msg.content || msg.kind !== 'text') return;
            if (aiContextHandledRef.current.has(msg.id)) return;

            const sharedCard = getLatestSharedThreadCard();
            const threadId = sharedCard?.threadId;
            if (!threadId) return;

            const status = threadStatusRef.current[threadId];
            // 読取設定が明示的にOFFなら送らない。source指定がある場合は一致時のみ送る。
            if (status?.readEnabled === false) return;
            if (status?.sourceRoomId && status.sourceRoomId !== roomId) return;

            try {
                // 念のため閲覧メンバーに登録（RLS回避）
                await ensureAiThreadViewMember(threadId);

                aiReadEnabledRef.current = status?.readEnabled ?? aiReadEnabledRef.current;
                aiContextHandledRef.current.add(msg.id);
                const contextContent = `${CHAT_CONTEXT_PREFIX} ${msg.sender_name || 'User'}: ${msg.content}`;
                const { error } = await supabase
                    .from('ai_messages')
                    .insert({
                        thread_id: threadId,
                        role: 'system',
                        sender_user_id: msg.sender_user_id,
                        sender_kind: 'system',
                        content: contextContent,
                    } as any);

                if (error) {
                    console.error('Failed to append chat context to AI thread:', error);
                    aiContextHandledRef.current.delete(msg.id);
                }
            } catch (err) {
                console.error('Failed to append chat context (exception):', err);
                aiContextHandledRef.current.delete(msg.id);
            }
        },
        [getLatestSharedThreadCard, supabase, userId, roomId, ensureAiThreadViewMember]
    );

    const resolveCustomName = useCallback(
        async (targetUserId: string, fallbackName?: string | null) => {
            if (!supabase || !userId || !targetUserId) return fallbackName || 'Unknown';
            try {
                const { data: friendship } = await supabase
                    .from('friendships')
                    .select('requester_id, requester_nickname, addressee_nickname')
                    .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`)
                    .maybeSingle();

                if (friendship) {
                    if (friendship.requester_id === userId && friendship.requester_nickname) {
                        return friendship.requester_nickname;
                    }
                    if (friendship.requester_id !== userId && friendship.addressee_nickname) {
                        return friendship.addressee_nickname;
                    }
                }
            } catch (e) {
                console.warn('Failed to resolve custom name', e);
            }
            return fallbackName || 'Unknown';
        },
        [supabase, userId]
    );

    const parseGroupLogEvent = useCallback((content: string | null): GroupLogEvent | null => {
        if (!content || content[0] !== '{') return null;
        try {
            const parsed = JSON.parse(content);
            if (parsed?.type === 'group_event') {
                return parsed as GroupLogEvent;
            }
        } catch {
            return null;
        }
        return null;
    }, []);

    const getSystemName = useCallback(
        (targetUserId?: string, fallbackName?: string | null) => {
            if (!targetUserId) return fallbackName || 'Unknown';
            return systemNameMap[targetUserId] || fallbackName || 'Unknown';
        },
        [systemNameMap]
    );

    const formatGroupLogMessage = useCallback(
        (content: string | null) => {
            const event = parseGroupLogEvent(content);
            if (!event) return content || '';

            const actorName = getSystemName(event.actorId);
            const targetName = event.targetId ? getSystemName(event.targetId) : '';
            const targetNames = event.targetIds?.map((id) => getSystemName(id)) || [];

            switch (event.action) {
                case 'settings_updated':
                    if (event.changes?.name && event.changes?.avatarUpdated) {
                        return `${actorName}がグループ名を「${event.changes.name}」に変更し、アイコンを更新しました`;
                    }
                    if (event.changes?.name) {
                        return `${actorName}がグループ名を「${event.changes.name}」に変更しました`;
                    }
                    if (event.changes?.avatarUpdated) {
                        return `${actorName}がグループアイコンを更新しました`;
                    }
                    return `${actorName}がグループ設定を更新しました`;
                case 'member_added':
                    return targetNames.length > 0
                        ? `${targetNames.join('、')}を${actorName}が追加しました`
                        : `メンバーを${actorName}が追加しました`;
                case 'member_removed':
                    return `${targetName}を${actorName}が削除しました`;
                case 'member_left':
                    return `${actorName}が退出しました`;
                default:
                    return content || '';
            }
        },
        [getSystemName, parseGroupLogEvent]
    );

    useEffect(() => {
        const ids = new Set<string>();
        messages.forEach((msg) => {
            if (msg.kind !== 'system') return;
            const event = parseGroupLogEvent(msg.content);
            if (!event) return;
            if (event.actorId) ids.add(event.actorId);
            if (event.targetId) ids.add(event.targetId);
            (event.targetIds || []).forEach((id) => ids.add(id));
        });

        const missing = Array.from(ids).filter((id) => !systemNameMap[id]);
        if (missing.length === 0) return;

        let canceled = false;
        const resolveMissing = async () => {
            const updates: Record<string, string> = {};
            await Promise.all(
                missing.map(async (id) => {
                    updates[id] = await resolveCustomName(id);
                })
            );
            if (!canceled) {
                setSystemNameMap((prev) => ({ ...prev, ...updates }));
            }
        };

        resolveMissing();

        return () => { canceled = true; };
    }, [messages, parseGroupLogEvent, resolveCustomName, systemNameMap]);

    // 既読機能関連
    const [otherMemberReadStatus, setOtherMemberReadStatus] = useState<{
        lastReadMessageId: string | null;
        lastReadAt: string | null;
        showReadStatus: boolean;
    } | null>(null);
    const [groupReadStatuses, setGroupReadStatuses] = useState<Array<{
        user_id: string;
        last_read_message_id: string | null;
        last_read_at: string | null;
        show_read_status: boolean;
        display_name: string;
        handle: string | null;
        avatar_path: string | null;
    }>>([]);
    const [myShowReadStatus, setMyShowReadStatus] = useState(true);
    const [readStatusSettingsOpen, setReadStatusSettingsOpen] = useState(false);
    const [readListMessageId, setReadListMessageId] = useState<string | null>(null);

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

    const logGroupEvent = async (event: GroupLogEvent) => {
        if (!supabase) return;
        try {
            await supabase.from('messages').insert({
                room_id: roomId,
                sender_user_id: userId,
                kind: 'system',
                content: JSON.stringify(event),
            } as any);
        } catch (err) {
            console.error('Failed to write group log:', err);
        }
    };

    // Leave/Delete room
    const handleLeaveRoom = async () => {
        if (!supabase) return;
        // For DM, mark hidden + clear my history. For groups, we leave.
        if (roomInfo?.type === 'dm') {
            const nowIso = new Date().toISOString();
            await (supabase
                .from('room_members') as any)
                .update({ hidden_at: nowIso, cleared_before: nowIso })
                .eq('room_id', roomId)
                .eq('user_id', userId);
            localStorage.setItem(`room-cleared-${roomId}`, nowIso);
            router.push('/talk');
        } else {
            try {
                const { data: membership, error: membershipError } = await (supabase
                    .from('room_members') as any)
                    .select('user_id')
                    .eq('room_id', roomId)
                    .eq('user_id', userId)
                    .maybeSingle();
                if (membershipError) {
                    throw membershipError;
                }
                if (!membership) {
                    const { error: hideError } = await (supabase
                        .from('room_members') as any)
                        .update({ hidden_at: new Date().toISOString() })
                        .eq('room_id', roomId)
                        .eq('user_id', userId);
                    if (hideError) {
                        throw hideError;
                    }
                    setLoadError('退出に失敗しました。もう一度お試しください。');
                    return;
                }

                await logGroupEvent({
                    type: 'group_event',
                    action: 'member_left',
                    actorId: userId,
                });

                const { error: preHideError } = await (supabase
                    .from('room_members') as any)
                    .update({ hidden_at: new Date().toISOString(), cleared_before: new Date().toISOString() })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
                if (preHideError) {
                    throw preHideError;
                }

                if (roomInfo?.group_id) {
                    const { error: groupError } = await (supabase
                        .from('group_members') as any)
                        .delete()
                        .eq('group_id', roomInfo.group_id)
                        .eq('user_id', userId);
                    if (groupError) {
                        throw groupError;
                    }
                }

                const { error: roomError } = await (supabase
                    .from('room_members') as any)
                    .delete()
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
                if (roomError) {
                    throw roomError;
                }

                router.replace('/talk');
                router.refresh();
            } catch (err) {
                console.error('Failed to leave room:', err);
                const { error: hideError } = await (supabase
                    .from('room_members') as any)
                    .update({ hidden_at: new Date().toISOString() })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
                if (hideError) {
                    console.error('Failed to hide room after leave failure:', hideError);
                }
                setLoadError('退出に失敗しました。もう一度お試しください。');
                router.replace('/talk');
                router.refresh();
            }
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

    // Auto scroll when split view opens on mobile (UI-002)
    const splitTabs = useSplitStore((state) => state.tabs);
    useEffect(() => {
        if (splitTabs.length > 0 && isMobile) {
            setTimeout(() => {
                scrollToBottom('auto');
            }, 500);
        }
    }, [splitTabs.length, isMobile, scrollToBottom]);

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

    const messageIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        messages.forEach((msg, index) => {
            map.set(msg.id, index);
        });
        return map;
    }, [messages]);

    const getGroupReadersForMessage = useCallback(
        (messageId: string) => {
            const messageIndex = messageIndexMap.get(messageId);
            if (messageIndex === undefined) return [];
            return groupReadStatuses.filter((member) => {
                if (!member.show_read_status) return false;
                if (member.user_id === userId) return false;
                if (!member.last_read_message_id) return false;
                const readIndex = messageIndexMap.get(member.last_read_message_id);
                if (readIndex === undefined) return false;
                return readIndex >= messageIndex;
            });
        },
        [groupReadStatuses, messageIndexMap, userId]
    );

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

            const { data: myMemberData } = await supabase
                .from('room_members')
                .select('show_read_status')
                .eq('room_id', roomId)
                .eq('user_id', userId)
                .single();

            if (myMemberData) {
                setMyShowReadStatus((myMemberData as any).show_read_status ?? true);
            }

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
                    .select('user_id, last_read_message_id, last_read_at, show_read_status')
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
                        friendId: (otherMember as any).user_id,
                        group_id: (room as any).group_id,
                    });

                    // 既読情報を取得（DM相手）
                    setOtherMemberReadStatus({
                        lastReadMessageId: (otherMember as any).last_read_message_id || null,
                        lastReadAt: (otherMember as any).last_read_at || null,
                        showReadStatus: (otherMember as any).show_read_status ?? true,
                    });
                } else {
                    setRoomInfo({ name, avatar_path: avatarPath, type: (room as any).type, group_id: (room as any).group_id });
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
                setRoomInfo({
                    name,
                    avatar_path: avatarPath,
                    type: (room as any).type,
                    group_id: (room as any).group_id,
                });

                const { data: members } = await supabase
                    .from('room_members')
                    .select('user_id, last_read_message_id, last_read_at, show_read_status')
                    .eq('room_id', roomId);

                if (members && members.length > 0) {
                    const memberIds = members.map((m: any) => m.user_id).filter(Boolean);
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('user_id, display_name, handle, avatar_path')
                        .in('user_id', memberIds);

                    const profileMap = new Map<string, any>();
                    (profiles || []).forEach((profile: any) => {
                        profileMap.set(profile.user_id, profile);
                    });

                    setGroupReadStatuses(
                        members.map((member: any) => {
                            const profile = profileMap.get(member.user_id);
                            const displayName = profile?.display_name || profile?.handle || 'Unknown';
                            return {
                                user_id: member.user_id,
                                last_read_message_id: member.last_read_message_id || null,
                                last_read_at: member.last_read_at || null,
                                show_read_status: member.show_read_status ?? true,
                                display_name: displayName,
                                handle: profile?.handle || null,
                                avatar_path: profile?.avatar_path || null,
                            };
                        })
                    );
                }
            }

            if ((room as any).type !== 'dm') {
                setRoomInfo({ name, avatar_path: avatarPath, type: (room as any).type, group_id: (room as any).group_id });
            }

            // Get messages
            // 自分が過去に「削除」した場合、そこを起点に新規メッセージのみ表示する
            const { data: myMembership } = await (supabase
                .from('room_members') as any)
                .select('cleared_before, hidden_at')
                .eq('room_id', roomId)
                .eq('user_id', userId)
                .maybeSingle();
            let clearedBefore = myMembership?.cleared_before ? new Date(myMembership.cleared_before) : null;
            if (!clearedBefore && myMembership?.hidden_at) {
                clearedBefore = new Date(myMembership.hidden_at);
            }
            if (!clearedBefore) {
                const localCutoff = localStorage.getItem(`room-cleared-${roomId}`);
                if (localCutoff) clearedBefore = new Date(localCutoff);
            }

            const { data: msgs, error: msgsError } = await supabase
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
                .eq('room_id', roomId)
                .gt('created_at', clearedBefore ? clearedBefore.toISOString() : '1970-01-01T00:00:00Z')
                .order('created_at', { ascending: true });

            let messageRows = msgs as any[] | null;

            if (msgsError || !messageRows) {
                console.error('Messages fetch error:', msgsError);
                setLoadError(`メッセージの取得に失敗しました: ${msgsError?.message || 'データがありません'}`);
                setLoading(false);
                return;
            }

            // Get unique sender IDs
            const senderIds = Array.from(new Set(messageRows.map((m) => m.sender_user_id)));
            const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_path')
                .in('user_id', senderIds);
            const profilesMap = (profiles || []).reduce((acc: Record<string, any>, profile: any) => {
                acc[profile.user_id] = profile;
                return acc;
            }, {});

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

            const baseNameMap: Record<string, string> = {};
            senderIds.forEach((id) => {
                baseNameMap[id] = nicknames[id] || profilesMap[id]?.display_name || 'Unknown';
            });
            setSystemNameMap(baseNameMap);

            const formattedMessages: Message[] = messageRows.map((msg) => {
                const sender = profilesMap[msg.sender_user_id];
                const displayName = nicknames[msg.sender_user_id] || sender?.display_name || 'Unknown';

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
                    .update({
                        last_read_message_id: messageRows[messageRows.length - 1].id,
                        last_read_at: new Date().toISOString()
                    })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);

                // Refresh notifications with delay
                setTimeout(() => {
                    useChatStore.getState().fetchNotifications();
                }, 1000);
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
                const senderName = await resolveCustomName(msgData.sender_user_id, (sender as any)?.display_name);
                setSystemNameMap((prev) => ({
                    ...prev,
                    [msgData.sender_user_id]: senderName || (sender as any)?.display_name || prev[msgData.sender_user_id] || 'Unknown',
                }));

                const formattedMsg: Message = {
                    id: msgData.id,
                    content: msgData.content,
                    kind: msgData.kind,
                    reply_to_message_id: msgData.reply_to_message_id,
                    sender_user_id: msgData.sender_user_id,
                    sender_name: senderName,
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

                void appendChatContextToThread(formattedMsg);

                // Update last read
                await (supabase
                    .from('room_members') as any)
                    .update({ last_read_message_id: msgData.id, last_read_at: new Date().toISOString() })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);

                // Refresh notifications
                setTimeout(() => {
                    useChatStore.getState().fetchNotifications();
                }, 1000);
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

        // Listen for room_members UPDATE events (for read status sync)
        channel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'room_members',
                filter: `room_id=eq.${roomId}`,
            },
            (payload: any) => {
                const updated = payload.new as any;
                // 相手の既読状態が更新された場合
                if (updated.user_id !== userId && roomInfo?.type === 'dm') {
                    setOtherMemberReadStatus({
                        lastReadMessageId: updated.last_read_message_id || null,
                        lastReadAt: updated.last_read_at || null,
                        showReadStatus: updated.show_read_status ?? true,
                    });
                }
                if (roomInfo?.type === 'group') {
                    setGroupReadStatuses((prev) => {
                        const existing = prev.find((member) => member.user_id === updated.user_id);
                        if (!existing) return prev;
                        return prev.map((member) =>
                            member.user_id === updated.user_id
                                ? {
                                    ...member,
                                    last_read_message_id: updated.last_read_message_id || null,
                                    last_read_at: updated.last_read_at || null,
                                    show_read_status: updated.show_read_status ?? true,
                                }
                                : member
                        );
                    });
                }
                // 自分の設定が更新された場合（別タブなどから）
                if (updated.user_id === userId) {
                    setMyShowReadStatus(updated.show_read_status ?? true);
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
    }, [supabase, roomId, userId, addTypingUser, removeTypingUser, setTypingUsers, fetchNotifications, resolveCustomName, roomInfo?.type]);

    // Listen for new message signals from RoomList (via ChatStore)
    const newMessageSignal = useChatStore((state) => state.newMessageSignal);

    useEffect(() => {
        if (!newMessageSignal) return;
        if (newMessageSignal.roomId !== roomId) return;
        if (!supabase) return;

        const messageId = newMessageSignal.messageId;

        // Check if we already have this message
        if (messagesRef.current.some((msg) => msg.id === messageId)) {
            return;
        }

        // Fetch the new message details
        const fetchNewMessage = async () => {
            if (!supabase) return;
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
            const senderName = await resolveCustomName(msgData.sender_user_id, (sender as any)?.display_name);
            setSystemNameMap((prev) => ({
                ...prev,
                [msgData.sender_user_id]: senderName || (sender as any)?.display_name || prev[msgData.sender_user_id] || 'Unknown',
            }));

            const formattedMsg: Message = {
                id: msgData.id,
                content: msgData.content,
                kind: msgData.kind,
                reply_to_message_id: msgData.reply_to_message_id,
                sender_user_id: msgData.sender_user_id,
                sender_name: senderName,
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

            void appendChatContextToThread(formattedMsg);

            // Update last read
            await (supabase
                .from('room_members') as any)
                .update({ last_read_message_id: msgData.id, last_read_at: new Date().toISOString() })
                .eq('room_id', roomId)
                .eq('user_id', userId);

            // Refresh notifications
            setTimeout(() => {
                useChatStore.getState().fetchNotifications();
            }, 1000);
            // Refresh notification badge  
        };

        fetchNewMessage();
    }, [newMessageSignal, roomId, supabase, userId, resolveCustomName]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!roomMenuOpen || !roomMenuContainerRef.current || !roomMenuAnchorRef.current) return;
        const frame = requestAnimationFrame(() => {
            const anchor = roomMenuAnchorRef.current!;
            const menuRect = roomMenuContainerRef.current!.getBoundingClientRect();
            const margin = 8;
            const viewport = window.visualViewport;
            const viewportWidth = viewport?.width ?? window.innerWidth;
            const viewportHeight = viewport?.height ?? window.innerHeight;
            const viewportLeft = viewport?.offsetLeft ?? 0;
            const viewportTop = viewport?.offsetTop ?? 0;

            let left = anchor.right - menuRect.width;
            let top = anchor.bottom + 8;

            if (left < viewportLeft + margin) left = viewportLeft + margin;
            if (left + menuRect.width > viewportLeft + viewportWidth - margin) {
                left = viewportLeft + viewportWidth - menuRect.width - margin;
            }

            if (top + menuRect.height > viewportTop + viewportHeight - margin) {
                top = anchor.top - menuRect.height - 8;
            }
            if (top < viewportTop + margin) top = viewportTop + margin;

            setRoomMenuPosition({ top, left, visibility: 'visible' });
        });

        return () => cancelAnimationFrame(frame);
    }, [roomMenuOpen]);

    useEffect(() => {
        if (!actionMenuMessageId || !actionMenuContainerRef.current || !actionMenuAnchorRef.current) return;
        const frame = requestAnimationFrame(() => {
            const anchor = actionMenuAnchorRef.current!;
            const menuRect = actionMenuContainerRef.current!.getBoundingClientRect();
            const margin = 8;
            const viewport = window.visualViewport;
            const viewportWidth = viewport?.width ?? window.innerWidth;
            const viewportHeight = viewport?.height ?? window.innerHeight;
            const viewportLeft = viewport?.offsetLeft ?? 0;
            const viewportTop = viewport?.offsetTop ?? 0;

            let left = actionMenuAlignRef.current === 'right'
                ? anchor.right - menuRect.width
                : anchor.left;
            let top = anchor.bottom + 4;

            if (left < viewportLeft + margin) left = viewportLeft + margin;
            if (left + menuRect.width > viewportLeft + viewportWidth - margin) {
                left = viewportLeft + viewportWidth - menuRect.width - margin;
            }

            if (top + menuRect.height > viewportTop + viewportHeight - margin) {
                top = anchor.top - menuRect.height - 8;
            }
            if (top < viewportTop + margin) top = viewportTop + margin;

            setActionMenuStyles({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                visibility: 'visible',
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [actionMenuMessageId]);

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

    useEffect(() => {
        if (!highlightMessageId || messages.length === 0) return;
        if (lastHighlightRef.current === highlightMessageId) return;
        lastHighlightRef.current = highlightMessageId;
        setTimeout(() => scrollToMessage(highlightMessageId), 50);
    }, [highlightMessageId, messages]);

    // Check availability and details of shared threads
    useEffect(() => {
        const checkThreads = async () => {
            const threadIds = messages
                .filter((m) => m.kind === 'shared_ai_thread' && m.sharedCard)
                .map((m) => m.sharedCard!.threadId);

            const allIds = Array.from(new Set(threadIds));
            // 読取管理を開いたときは最新状態へリフレッシュ、それ以外は未取得のみ
            const fetchIds = showThreadReadManager ? allIds : allIds.filter((id) => !(id in threadStatus));
            if (fetchIds.length === 0) return;

            const { data: threads } = await supabase
                .from('ai_threads')
                .select('id, title, archived_at, created_at, owner_user_id, model, source_room_id, read_enabled')
                .in('id', fetchIds);

            if (!threads) return;

            // Fetch owners
            const ownerIds = Array.from(new Set(threads.map((t: any) => t.owner_user_id)));
            const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_path, handle')
                .in('user_id', ownerIds);

            // Fetch key status (RPC)
            const { data: keyStatus } = await supabase
                .rpc('get_thread_owner_key_status', { p_thread_ids: fetchIds });

            const keyMap = new Map();
            if (keyStatus) {
                (keyStatus as any[]).forEach((k: any) => {
                    keyMap.set(k.thread_id, k.has_key);
                });
            }

            setThreadStatus((prev) => {
                const next = showThreadReadManager ? { ...prev } : { ...prev };
                fetchIds.forEach((id) => {
                    const found = threads.find((t: any) => t.id === id);
                    if (found) {
                        const owner = profiles?.find((p: any) => p.user_id === found.owner_user_id);
                        next[id] = {
                            exists: true,
                            archived: !!found.archived_at,
                            createdAt: found.created_at,
                            model: found.model,
                            title: found.title,
                            sourceRoomId: found.source_room_id,
                            readEnabled: found.read_enabled,
                            // treat "unknown" as null so we don't falsely show inactive styling
                            ownerHasKey: keyMap.has(id) ? keyMap.get(id) : null,
                            owner: owner
                                ? {
                                    userId: owner.user_id,
                                    displayName: owner.display_name || owner.handle || 'Unknown',
                                    avatarPath: owner.avatar_path,
                                }
                                : undefined,
                        };
                    } else {
                        // 見つからない＝削除済みとみなしてカードに表示する
                        next[id] = {
                            exists: false,
                            archived: false,
                            ownerHasKey: keyMap.has(id) ? keyMap.get(id) : null,
                        };
                    }
                });
                return next;
            });
        };

        if (messages.length > 0) {
            checkThreads();
        }
    }, [messages, supabase, showThreadReadManager]);

    // Realtime update for shared thread cards
    useEffect(() => {
        if (!supabase) return;

        const channel = supabase
            .channel(`room_thread_updates_global_${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_threads',
                },
                (payload: any) => {
                    const updated = payload.new as any;
                    setThreadStatus((prev) => {
                        if (prev[updated.id]) {
                            return {
                                ...prev,
                                [updated.id]: {
                                    ...prev[updated.id],
                                    title: updated.title,
                                    model: updated.model,
                                    archived: !!updated.archived_at,
                                    sourceRoomId: updated.source_room_id,
                                    readEnabled: updated.read_enabled,
                                },
                            };
                        }
                        return prev;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, roomId]);

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

    const handleCreateAndSendThread = async () => {
        if (!supabase) return;
        setThreadPickerCreating(true);
        setThreadPickerError(null);

        try {
            let initialModel = 'gpt-5.2';
            try {
                const { data: keys } = await supabase
                    .from('user_llm_keys')
                    .select('provider')
                    .eq('user_id', userId);
                const providers = new Set(keys?.map((k: any) => k.provider) || []);
                if (providers.has('openai')) {
                    initialModel = 'gpt-5.2';
                } else if (providers.has('google')) {
                    initialModel = 'gemini-2.5-flash';
                }
            } catch {
                // keep default
            }

            const baseTitle = roomInfo?.name ? `${roomInfo.name}のスレッド` : '新規スレッド';
            const { data: newThread, error } = await supabase
                .from('ai_threads')
                .insert({
                    owner_user_id: userId,
                    title: baseTitle,
                    model: initialModel,
                } as any)
                .select('id, title, model, created_at')
                .single();

            if (error || !newThread) {
                throw error || new Error('Failed to create thread');
            }

            await handleSendThread(newThread);
        } catch (e) {
            console.error('Failed to create and share thread:', e);
            setThreadPickerError('スレッドの作成に失敗しました');
        } finally {
            setThreadPickerCreating(false);
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
                        content: content || '',
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

            void appendChatContextToThread(optimisticMessage);

            await (supabase
                .from('room_members') as any)
                .update({ last_read_message_id: newMessage.id, last_read_at: new Date().toISOString() })
                .eq('room_id', roomId)
                .eq('user_id', userId);

            if (attachmentsSnapshot.length > 0) {
                for (const file of attachmentsSnapshot) {
                    // Get file extension
                    const ext = file.name.split('.').pop() || '';
                    const fileName = `${crypto.randomUUID()}.${ext}`;
                    const path = `${roomId}/${newMessage.id}/${fileName}`;

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('chat-attachments')
                        .upload(path, file, {
                            contentType: file.type || 'application/octet-stream',
                            cacheControl: '3600',
                            upsert: false,
                        });

                    if (uploadError) {
                        console.error('File upload error:', uploadError);
                        setAttachmentError(`添付ファイルのアップロードに失敗しました: ${uploadError.message}`);
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
            if (isMobile) {
                inputRef.current?.blur();
            } else {
                inputRef.current?.focus();
            }
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
            // Ensure this thread reads from this room by default
            await supabase
                .from('ai_threads')
                .update({ source_room_id: roomId, read_enabled: true })
                .eq('id', thread.id)
                .is('source_room_id', null);

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
                .update({ last_read_message_id: (inserted as any).id, last_read_at: new Date().toISOString() })
                .eq('room_id', roomId)
                .eq('user_id', userId);

            // Refresh notifications
            setTimeout(() => {
                useChatStore.getState().fetchNotifications();
            }, 1000);
        }
    };

    const handleSaveNickname = async (newName: string) => {
        if (!roomInfo?.friendId) return;

        // Find friendship
        const { data: friendship, error: fetchError } = await (supabase
            .from('friendships') as any)
            .select('id, requester_id, addressee_id')
            .or(`and(requester_id.eq.${userId},addressee_id.eq.${roomInfo.friendId}),and(requester_id.eq.${roomInfo.friendId},addressee_id.eq.${userId})`)
            .maybeSingle();

        if (fetchError || !friendship) {
            console.error('Friendship not found or error:', fetchError);
            return;
        }

        const updateData = friendship.requester_id === userId
            ? { requester_nickname: newName }
            : { addressee_nickname: newName };

        const { error } = await (supabase
            .from('friendships') as any)
            .update(updateData)
            .eq('id', friendship.id);

        if (error) {
            console.error('Failed to update nickname', error);
        } else {
            // Update local state
            setRoomInfo((prev) => prev ? ({ ...prev, name: newName }) : null);
            // Refresh friends list if open elsewhere? fetchNotifications might not be enough but it's fine.
        }
    };

    // 既読表示設定を切り替え
    const handleToggleReadStatus = async (show: boolean) => {
        if (!supabase) return;

        try {
            const { error } = await supabase.rpc('toggle_read_status_visibility', {
                p_room_id: roomId,
                p_show: show,
            });

            if (error) throw error;

            setMyShowReadStatus(show);
            setReadStatusSettingsOpen(false);
        } catch (e) {
            console.error('Failed to toggle read status:', e);
            alert('設定の変更に失敗しました');
        }
    };

    const handleAttachClick = (e: any) => {
        e.stopPropagation();
        setAttachMenuOpen(!attachMenuOpen);
    };

    const handleFileOption = (e: any) => {
        e.stopPropagation();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Delay closing to prevent blocking the native file dialog
        setTimeout(() => setAttachMenuOpen(false), 500);
    };

    const handleThreadOption = () => {
        setThreadPickerOpen(true);
        setThreadPickerError(null);
        fetchThreadsForPicker();
    };

    const getThreadLogChannel = useCallback(
        (threadId: string) => {
            if (!threadLogChannelsRef.current[threadId]) {
                const channel = supabase.channel(`ai_thread_log_${threadId}`);
                channel.subscribe();
                threadLogChannelsRef.current[threadId] = channel;
            }
            return threadLogChannelsRef.current[threadId];
        },
        [supabase]
    );

    const broadcastThreadLog = useCallback(
        (threadId: string, payload: any) => {
            try {
                const channel = getThreadLogChannel(threadId);
                channel.send({
                    type: 'broadcast',
                    event: 'system_log',
                    payload,
                });
            } catch (e) {
                console.warn('Failed to broadcast thread log', e);
            }
        },
        [getThreadLogChannel]
    );

    const uniqueSharedThreadIds = useMemo(() => {
        const ids = messages
            .filter((m) => m.kind === 'shared_ai_thread' && m.sharedCard?.threadId)
            .map((m) => m.sharedCard!.threadId);
        return Array.from(new Set(ids));
    }, [messages]);

    useEffect(() => {
        return () => {
            Object.values(threadLogChannelsRef.current).forEach((channel) => {
                supabase.removeChannel(channel);
            });
            threadLogChannelsRef.current = {};
        };
    }, [supabase]);

    const handleToggleThreadRead = async (threadId: string, nextEnabled: boolean) => {
        if (!supabase) return;
        try {
            const { error: updateError } = await (supabase
                .from('ai_threads') as any)
                .update({
                    read_enabled: nextEnabled,
                    // 読み取りを有効にする場合はこのトークを読込先としてセット
                    source_room_id: nextEnabled ? roomId : null,
                })
                .eq('id', threadId);
            if (updateError) throw updateError;

            // ローカル状態も即時反映してボタン表示を安定化
            setThreadStatus((prev) => ({
                ...prev,
                [threadId]: {
                    ...(prev[threadId] || {}),
                    readEnabled: nextEnabled,
                    sourceRoomId: nextEnabled ? roomId : null,
                },
            }));

            const title = threadStatus[threadId]?.title || 'AIスレッド';
            const prevSourceRoomId = threadStatus[threadId]?.sourceRoomId || null;
            // ログをトーク側に記録（best effort）
            await supabase.from('messages').insert({
                room_id: roomId,
                sender_user_id: userId,
                kind: 'system',
                content: `${currentUserName || 'ユーザ'}がスレッド「${title}」の読取を${nextEnabled ? 'オン' : 'オフ'}にしました`,
            } as any);

            const roomName = roomInfo?.name || 'トーク';
            const { data: readLog, error: readLogError } = await supabase
                .from('ai_messages')
                .insert({
                    thread_id: threadId,
                    role: 'system',
                    sender_user_id: userId,
                    sender_kind: 'system',
                    content: `${currentUserName || 'ユーザ'}が${roomName}の読取を${nextEnabled ? 'オン' : 'オフ'}にしました`,
                } as any)
                .select('id, thread_id, role, sender_user_id, sender_kind, content, created_at')
                .single();
            if (readLogError) {
                console.error('Failed to write thread read log', readLogError);
            } else if (readLog) {
                broadcastThreadLog(threadId, readLog);
            }

            // 読込先変更ログはトーク側操作時には出さず、オン/オフログのみ表示する
        } catch (err) {
            console.error('Failed to toggle thread read setting', err);
            // 失敗時はUIを元に戻し、最新状態を再フェッチ
            setThreadStatus((prev) => ({
                ...prev,
                [threadId]: {
                    ...(prev[threadId] || {}),
                    readEnabled: prev[threadId]?.readEnabled ?? true,
                    sourceRoomId: prev[threadId]?.sourceRoomId ?? null,
                },
            }));
        }
    };

    // File processing logic (shared between input and DnD)
    const processFiles = (files: File[]) => {
        if (files.length === 0) return;

        const maxSize = 25 * 1024 * 1024;
        const validFiles: File[] = [];
        let sizeError = false;
        let videoError = false;

        files.forEach((file) => {
            // Video files are not allowed (UI-006)
            if (file.type.startsWith('video/')) {
                videoError = true;
                return;
            }

            if (file.size > maxSize) {
                sizeError = true;
                return;
            }
            validFiles.push(file);
        });

        if (videoError) {
            setAttachmentError('動画ファイルは送信できません');
            setTimeout(() => setAttachmentError(null), 4000);
        } else if (sizeError) {
            setAttachmentError('ファイルサイズは25MB以下にしてください');
            setTimeout(() => setAttachmentError(null), 4000);
        }

        if (validFiles.length > 0) {
            setPendingAttachments((prev) => [...prev, ...validFiles]);
        }
    };

    const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        processFiles(files);
        event.target.value = '';
    };

    // Drag and Drop handlers (UI-012)
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
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

    // ローディング時もヘッダーを表示するため、早期リターンではなくコンテンツ内でオーバーレイ表示

    return (
        <div
            className="flex flex-col h-full bg-surface-50 dark:bg-black/20 relative"
            onClick={() => setAttachMenuOpen(false)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary-500/10 backdrop-blur-sm border-2 border-primary-500 border-dashed m-4 rounded-xl pointer-events-none">
                    <div className="bg-white dark:bg-surface-800 p-6 rounded-xl shadow-xl flex flex-col items-center gap-4 animate-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium text-surface-900 dark:text-surface-100">ファイルをドロップして送信</p>
                    </div>
                </div>
            )}    <header className="flex items-center gap-3 px-4 h-14 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 sticky top-0 z-20">
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
                <div className="flex-1 min-w-0 flex items-center">
                    <h2 className="font-semibold truncate">{roomInfo?.name || 'トーク'}</h2>
                    {roomInfo?.type === 'dm' && (
                        <button
                            onClick={() => setIsEditingName(true)}
                            className="ml-2 text-surface-400 hover:text-surface-600 transition-colors flex-shrink-0"
                            title="表示名を変更"
                        >
                            <PencilIcon className="w-4 h-4" />
                        </button>
                    )}
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
                        ref={roomMenuButtonRef}
                        onClick={() => {
                            if (!roomMenuOpen && roomMenuButtonRef.current) {
                                const rect = roomMenuButtonRef.current.getBoundingClientRect();
                                roomMenuAnchorRef.current = rect;
                                setRoomMenuPosition({ top: rect.bottom + 8, left: rect.right - 192, visibility: 'hidden' });
                                setRoomMenuOpen(true);
                            } else {
                                setRoomMenuOpen(false);
                            }
                        }}
                        className="btn-icon p-2"
                        aria-label="メニュー"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                    </button>
                    {roomMenuOpen && portalReady && createPortal(
                        <>
                            <div className="fixed inset-0 z-[9998]" onClick={() => setRoomMenuOpen(false)} />
                            <div
                                ref={roomMenuContainerRef}
                                className="fixed w-56 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-[9999]"
                                style={{ top: roomMenuPosition.top, left: roomMenuPosition.left, visibility: roomMenuPosition.visibility }}
                            >
                                {roomInfo?.type === 'group' && (
                                    <>
                                        <button
                                            onClick={() => { setRoomMenuOpen(false); setGroupSettingsInitialView('invite'); setShowGroupSettings(true); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                        >
                                            <UserPlusIcon className="w-5 h-5 text-surface-500" />
                                            <span className="text-sm font-medium">招待</span>
                                        </button>
                                        <button
                                            onClick={() => { setRoomMenuOpen(false); setGroupSettingsInitialView('members'); setShowGroupSettings(true); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                        >
                                            <UserGroupIcon className="w-5 h-5 text-surface-500" />
                                            <span className="text-sm font-medium">メンバー</span>
                                        </button>
                                        <button
                                            onClick={() => { setRoomMenuOpen(false); setGroupSettingsInitialView('settings'); setShowGroupSettings(true); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                        >
                                            <Cog6ToothIcon className="w-5 h-5 text-surface-500" />
                                            <span className="text-sm font-medium">設定</span>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => { setRoomMenuOpen(false); setShowThreadReadManager(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                >
                                    <SparklesIcon className="w-5 h-5 text-surface-500" />
                                    <span className="text-sm font-medium whitespace-nowrap">スレッド読取管理</span>
                                </button>
                                {roomInfo?.type === 'dm' && (
                                    <button
                                        onClick={() => { setRoomMenuOpen(false); setReadStatusSettingsOpen(true); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                                    >
                                        <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-sm font-medium">既読設定</span>
                                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${myShowReadStatus ? 'bg-emerald-100 text-emerald-600' : 'bg-surface-200 text-surface-500'}`}>
                                            {myShowReadStatus ? 'ON' : 'OFF'}
                                        </span>
                                    </button>
                                )}
                                <div className="border-t border-surface-100 dark:border-surface-700 my-1" />
                                <button
                                    onClick={() => { setRoomMenuOpen(false); setConfirmHideRoom(true); }}
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
                        </>,
                        document.body
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
                        className="flex-1 text-sm py-1.5 px-4 rounded-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
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
                                    ? 'このトークを削除すると、あなた側の履歴は消えます（相手には影響しません）。'
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

            {/* Group Settings Modal */}
            {showGroupSettings && roomInfo?.group_id && (
                <ChatGroupSettings
                    isOpen={showGroupSettings}
                    onClose={() => setShowGroupSettings(false)}
                    roomId={roomId}
                    groupId={roomInfo.group_id!}
                    userId={userId}
                    initialView={groupSettingsInitialView}
                />
            )}

            {/* Read Status Settings Modal */}
            {readStatusSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReadStatusSettingsOpen(false)}>
                    <div className="w-full max-w-sm bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-4">既読設定</h3>
                            <p className="text-sm text-surface-500 mb-6">
                                既読をONにすると、あなたがメッセージを読んだことが相手に表示されます。
                                OFFにすると、相手にはあなたの既読状態が見えなくなります。
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => handleToggleReadStatus(true)}
                                    className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${myShowReadStatus
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${myShowReadStatus ? 'border-primary-500 bg-primary-500' : 'border-surface-300'
                                        }`}>
                                        {myShowReadStatus && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">既読を表示する</p>
                                        <p className="text-xs text-surface-500">相手に既読が見えます</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleToggleReadStatus(false)}
                                    className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${!myShowReadStatus
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!myShowReadStatus ? 'border-primary-500 bg-primary-500' : 'border-surface-300'
                                        }`}>
                                        {!myShowReadStatus && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">既読を非表示にする</p>
                                        <p className="text-xs text-surface-500">相手に既読が見えません</p>
                                    </div>
                                </button>
                            </div>
                            <button
                                onClick={() => setReadStatusSettingsOpen(false)}
                                className="w-full mt-4 btn-secondary py-2.5"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto px-4 pt-4 pb-20 space-y-4 chat-bg relative"
            >
                {/* Loading overlay */}
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface-900 z-10">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
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
                            const isHighlighted = msg.id === highlightMessageId;
                            // UI-011: Check if message is image only to remove bubble
                            const isImageOnly = !msg.content && hasAttachments && (msg.attachments || []).every((att: any) => {
                                const ext = att.object_path.split('.').pop()?.toLowerCase();
                                return att.mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                            });
                            // UI-011: Remove bubble for shared thread cards
                            const isSharedCard = msg.kind === 'shared_ai_thread';
                            const shouldRemoveBubble = isImageOnly || isSharedCard;
                            const sharedCard = msg.sharedCard;

                            if (msg.kind === 'system') {
                                return (
                                    <div key={msg.id} className="flex justify-center my-4">
                                        <div className="bg-surface-100 dark:bg-surface-800 text-surface-500 text-xs px-3 py-1.5 rounded-full shadow-sm">
                                            {formatGroupLogMessage(msg.content)}
                                        </div>
                                    </div>
                                );
                            }

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
                                                    "relative text-sm md:text-base break-words",
                                                    isHighlighted && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-white dark:ring-offset-surface-900",
                                                    shouldRemoveBubble
                                                        ? "p-0 bg-transparent border-none shadow-none"
                                                        : cn(
                                                            "px-3 py-2 shadow-sm",
                                                            msg.is_mine
                                                                ? "bg-primary-500 text-white rounded-2xl rounded-tr-sm"
                                                                : "bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-2xl rounded-tl-sm"
                                                        )
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
                                                                    {threadStatus[sharedCard.threadId]?.title || sharedCard.titleSnapshot || '名称未設定のスレッド'}
                                                                </p>
                                                                {!threadStatus[sharedCard.threadId]?.exists && (
                                                                    <p className="text-[12px] text-surface-500 mt-1 line-clamp-2">
                                                                        このスレッドは削除されました。内容は表示できません。
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Metadata Row */}
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 textxs text-surface-500 mb-3 px-1 text-[10px]">
                                                            {(() => {
                                                                const status = threadStatus[sharedCard.threadId];
                                                                const model = status?.model || sharedCard.modelSnapshot;
                                                                const ownerKey = status?.ownerHasKey;
                                                                const isOwner = status?.owner?.userId === userId;
                                                                // If we don't know the key status (null/undefined), prefer active styling
                                                                const modelStyle = ownerKey === false
                                                                    ? "bg-transparent text-surface-500 border border-surface-300 dark:text-surface-400 dark:border-surface-700"
                                                                    : isOwner
                                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800"
                                                                        : "bg-transparent text-emerald-600 border border-surface-200 dark:text-emerald-400 dark:border-surface-700";

                                                                return (
                                                                    <span className={cn("font-medium px-1.5 py-0.5 rounded transition-colors", modelStyle)}>
                                                                        {model?.replace('gpt-', 'GPT-').replace('gemini-', 'Gemini ') || 'Unknown'}
                                                                    </span>
                                                                );
                                                            })()}

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
                                                                if (isMobile) return null;
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
                                                                            void ensureAiThreadViewMember(sharedCard.threadId);
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
                                                                            void ensureAiThreadViewMember(sharedCard.threadId);
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
                                                                            void ensureAiThreadViewMember(sharedCard.threadId);
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
                                                                {formatMessageContent(msg.content, msg.is_mine, searchQuery)}
                                                            </p>
                                                        )}
                                                        {hasAttachments && (
                                                            <div className="mt-2 space-y-2">
                                                                {(msg.attachments || []).map((attachment) => {
                                                                    const ext = attachment.object_path.split('.').pop()?.toLowerCase();
                                                                    const isImage = attachment.mime.startsWith('image/') ||
                                                                        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                                                                    const imageUrl = getStorageUrl('chat-attachments', attachment.object_path);

                                                                    if (isImage) {
                                                                        return (
                                                                            <div key={attachment.id} className="relative">
                                                                                <a
                                                                                    href={imageUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="block"
                                                                                >
                                                                                    <img
                                                                                        src={imageUrl}
                                                                                        alt={getAttachmentName(attachment.object_path)}
                                                                                        className="max-w-full max-h-64 rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                                                                        loading="lazy"
                                                                                    />
                                                                                </a>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <div
                                                                            key={attachment.id}
                                                                            className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/70 dark:bg-surface-900/40 px-2 py-1"
                                                                        >
                                                                            <span className="text-sm">📎</span>
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
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Metadata (Time & Read Status) - Outside bubble */}
                                            <div className="flex flex-col justify-end gap-px text-[10px] text-surface-400 dark:text-surface-500 font-medium whitespace-nowrap self-end mb-0.5 mx-1">
                                                {/* 既読表示 */}
                                                {msg.is_mine && roomInfo?.type === 'dm' && otherMemberReadStatus?.showReadStatus && otherMemberReadStatus.lastReadMessageId && (() => {
                                                    const myMessages = messages.filter(m => m.is_mine);
                                                    const lastMyMessage = myMessages[myMessages.length - 1];
                                                    const isLastMyMessage = lastMyMessage?.id === msg.id;
                                                    const readMsgIndex = messages.findIndex(m => m.id === otherMemberReadStatus.lastReadMessageId);
                                                    const thisMsgIndex = messages.findIndex(m => m.id === msg.id);
                                                    const isRead = readMsgIndex >= thisMsgIndex;

                                                    if (isLastMyMessage && isRead) {
                                                        return (
                                                            <span className="text-surface-400 dark:text-surface-500">既読</span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                {msg.is_mine && roomInfo?.type === 'group' && (() => {
                                                    const myMessages = messages.filter(m => m.is_mine);
                                                    const lastMyMessage = myMessages[myMessages.length - 1];
                                                    const isLastMyMessage = lastMyMessage?.id === msg.id;
                                                    if (!isLastMyMessage) return null;
                                                    const readers = getGroupReadersForMessage(msg.id);
                                                    if (readers.length === 0) return null;
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => setReadListMessageId(msg.id)}
                                                            className="text-surface-400 dark:text-surface-500 hover:text-surface-600"
                                                        >
                                                            既読 {readers.length}
                                                        </button>
                                                    );
                                                })()}

                                                {/* 時間表示 */}
                                                <span>{formatMessageTime(msg.created_at)}</span>
                                            </div>

                                            {/* Action button - beside message, aligned to top */}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const isMine = msg.is_mine;
                                                            actionMenuAnchorRef.current = rect;
                                                            actionMenuAlignRef.current = isMine ? 'right' : 'left';
                                                            setActionMenuStyles({
                                                                position: 'fixed',
                                                                top: `${rect.bottom + 4}px`,
                                                                left: `${rect.left}px`,
                                                                visibility: 'hidden',
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setThreadPickerOpen(false)}>
                    <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                            <h3 className="font-semibold">AIスレッドを選択</h3>
                            <button onClick={() => setThreadPickerOpen(false)} className="btn-icon">✕</button>
                        </div>
                        <div className="p-3 border-b border-surface-200 dark:border-surface-800">
                            <button
                                onClick={handleCreateAndSendThread}
                                disabled={threadPickerCreating}
                                className="w-full btn-primary py-2 text-sm"
                            >
                                新規AIスレッドを作成して共有
                            </button>
                            {threadPickerError && (
                                <p className="mt-2 text-xs text-error-600 dark:text-error-400">
                                    {threadPickerError}
                                </p>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {availableThreads.length > 0 ? (
                                availableThreads.map(thread => (
                                    <button
                                        key={thread.id}
                                        onClick={() => handleSendThread(thread)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-left"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{thread.title}</p>
                                            <p className="text-xs text-surface-500">
                                                {thread.model}
                                                {thread.created_at && (
                                                    <span className="ml-2">
                                                        作成 {new Date(thread.created_at).toLocaleDateString('ja-JP')}
                                                    </span>
                                                )}
                                            </p>
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
            {readListMessageId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReadListMessageId(null)}>
                    <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">既読メンバー</h3>
                            <button className="btn-icon p-2" onClick={() => setReadListMessageId(null)} aria-label="閉じる">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
                            {(() => {
                                const readers = getGroupReadersForMessage(readListMessageId);
                                if (readers.length === 0) {
                                    return <div className="p-5 text-sm text-surface-500">既読メンバーはいません</div>;
                                }
                                return readers.map((member) => (
                                    <div key={member.user_id} className="flex items-center gap-3 px-5 py-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
                                            {member.avatar_path ? (
                                                <img
                                                    src={getStorageUrl('avatars', member.avatar_path)}
                                                    alt={member.display_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-surface-600 dark:text-surface-300">
                                                    {getInitials(member.display_name)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{member.display_name}</p>
                                            {member.handle && (
                                                <p className="text-xs text-surface-500">@{member.handle}</p>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
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
                        {pendingAttachments.map((file, index) => {
                            const isImage = file.type.startsWith('image/');
                            return (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-2 py-1 text-xs"
                                >
                                    {isImage ? (
                                        <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                                onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-sm">📎</span>
                                    )}
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
                            );
                        })}
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
                        id="chat-file-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                        multiple
                        className="fixed top-0 left-0 w-px h-px opacity-0 overflow-hidden"
                        onChange={handleFilesSelected}
                    />

                    <div className="relative self-center">
                        {attachMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-20 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <label
                                        htmlFor="chat-file-input"
                                        onClick={handleFileOption}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left cursor-pointer"
                                    >
                                        <PhotoIcon className="w-5 h-5 text-primary-500" />
                                        <span className="text-sm font-medium">画像・ファイル</span>
                                    </label>
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
                            onFocus={() => {
                                if (isMobile) {
                                    setTimeout(() => {
                                        scrollToBottom('auto');
                                        // Ensure input area is visible (UI-004)
                                        fileInputRef.current?.parentElement?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                    }, 400);
                                }
                            }}
                            onBlur={stopTyping}
                            placeholder="メッセージを入力..."
                            rows={1}
                            style={{ minHeight: '38px', height: '38px' }}
                            data-chat-input="true"
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
            {actionMenuMessageId && portalReady && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setActionMenuMessageId(null)} />
                    <div
                        ref={actionMenuContainerRef}
                        style={actionMenuStyles}
                        className="fixed w-28 bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-[9999]"
                    >
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
                </>,
                document.body
            )}

            {/* Edit Nickname Dialog */}
            <EditNicknameDialog
                isOpen={isEditingName}
                onClose={() => setIsEditingName(false)}
                currentName={roomInfo?.name || ''}
                onSave={handleSaveNickname}
            />
            {/* スレッド読取管理モーダル */}
            {showThreadReadManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowThreadReadManager(false)}>
                    <div className="w-full max-w-lg bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">スレッド読取管理</h3>
                                <p className="text-sm text-surface-500">このトークで共有されているスレッドごとに読取を切替えます</p>
                            </div>
                            <button className="btn-icon p-2" onClick={() => setShowThreadReadManager(false)} aria-label="閉じる">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
                            {uniqueSharedThreadIds.length === 0 && (
                                <div className="p-5 text-sm text-surface-500">共有スレッドはありません</div>
                            )}
                            {uniqueSharedThreadIds.map((tid) => {
                                const status = threadStatus[tid];
                                const title = status?.title || '名称未設定のスレッド';
                                const enabled = status?.readEnabled ?? true;
                                const linkedHere = status?.sourceRoomId ? status.sourceRoomId === roomId : true;
                                return (
                                    <div key={tid} className="flex items-center gap-3 px-5 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{title}</p>
                                            <p className="text-xs text-surface-500 flex items-center gap-2 flex-wrap">
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-surface-400">モデル:</span>
                                                    <span className="font-medium">{status?.model || '未設定'}</span>
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-surface-400">共有日時:</span>
                                                    <span className="font-mono">{status?.createdAt ? new Date(status.createdAt).toLocaleDateString('ja-JP') : '-'}</span>
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-surface-400">オーナー:</span>
                                                    <span className="font-medium">{status?.owner?.displayName || '不明'}</span>
                                                </span>
                                                {!linkedHere && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">別トークを読込先</span>
                                                )}
                                                {!enabled && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">読取オフ</span>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleToggleThreadRead(tid, !enabled)}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300'}`}
                                        >
                                            {enabled ? '読ませる' : '読まない'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatRoom;
