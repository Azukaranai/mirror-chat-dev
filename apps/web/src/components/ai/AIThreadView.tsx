'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CHAT_CONTEXT_PREFIX } from '@/lib/utils';
import { createSharedAIThreadCard, cn, getStorageUrl, getInitials } from '@/lib/utils';
import { useAIStore, useSplitStore } from '@/lib/stores';
import type { AIThread } from '@/types/database';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Icons
const XMarkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

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

const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const ShareIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
);

const ArchiveIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18m-16.5 0A1.5 1.5 0 003 9v9a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 18V9a1.5 1.5 0 00-1.5-1.5M9 12h6" />
    </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-10.5 0V6a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0113.5 6v1.5m-7.5 0l.75 12A1.5 1.5 0 008.25 21h7.5a1.5 1.5 0 001.5-1.5l.75-12" />
    </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

const EllipsisVerticalIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
);

const DuplicateIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25h-6A2.25 2.25 0 006 6v8.25M9.75 15.75h6a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-2.25-2.25h-6A2.25 2.25 0 007.5 7.5v6a2.25 2.25 0 002.25 2.25z" />
    </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.75a3.75 3.75 0 00-7.5 0m7.5 0v.75a1.5 1.5 0 01-1.5 1.5h-4.5a1.5 1.5 0 01-1.5-1.5v-.75m7.5 0a3.75 3.75 0 00-7.5 0M15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 1.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
);

const THREAD_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const decodeThreadId = (pathname: string) => {
    const match = pathname.match(/^\/ai\/([^/]+)/);
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
};

const shouldBlockAiThreadLink = (href?: string) => {
    if (!href) return false;
    try {
        const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
        const url = new URL(href, base);
        if (url.pathname.startsWith('/ai/')) {
            const candidate = decodeThreadId(url.pathname);
            if (candidate && !THREAD_ID_REGEX.test(candidate)) {
                return true;
            }
        }
    } catch {
        return false;
    }
    return false;
};

const MarkdownLink: Components['a'] = ({ href, children }) => {
    if (!href) return <>{children}</>;
    const block = shouldBlockAiThreadLink(href);

    if (block) {
        return <span className="text-surface-500">{children}</span>;
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-500 underline decoration-primary-500/60 hover:decoration-primary-500"
        >
            {children}
        </a>
    );
};

const markdownComponents = { a: MarkdownLink } satisfies Components;

const KeyIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3.75 3.75 0 01-3.478 5.196l-1.272 1.272v1.062h-1.5v1.5H8.25v1.5H6.75v-3.183l3.03-3.03A3.75 3.75 0 1115.75 5.25z" />
    </svg>
);

const ShareToChatIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v9m0 0l3-3m-3 3l-3-3m9 6.75H6.75A2.25 2.25 0 014.5 14.25v-6A2.25 2.25 0 016.75 6h10.5A2.25 2.25 0 0119.5 8.25v6A2.25 2.25 0 0117.25 16.5z" />
    </svg>
);

interface AIMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sender_kind: 'owner' | 'collaborator' | 'assistant' | 'system';
    sender_name?: string;
    sender_user_id?: string;
    created_at: string;
}

interface AIThreadViewProps {
    threadId: string;
    userId: string;
    isOwner: boolean;
    thread: AIThread | null;
    permission?: 'VIEW' | 'INTERVENE' | null;
    variant?: 'page' | 'embedded';
}

export function AIThreadView({
    threadId,
    userId,
    isOwner: initialIsOwner,
    thread: initialThread,
    permission = null,
    variant = 'page',
}: AIThreadViewProps) {
    const getProvider = (model: string) => model.startsWith('gemini') ? 'google' : 'openai';
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    // Use store with updated definition
    const streamingContent = useAIStore(state => state.streamingContent);
    const setStreamingContent = useAIStore(state => state.setStreamingContent);
    const runningThreads = useAIStore(state => state.runningThreads);
    const addRunningThread = useAIStore(state => state.addRunningThread);
    const removeRunningThread = useAIStore(state => state.removeRunningThread);

    const isRunning = runningThreads.has(threadId);
    const currentStream = streamingContent.get(threadId) || '';

    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [thread, setThread] = useState(initialThread);
    const [isOwner, setIsOwner] = useState(initialIsOwner);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(true);
    const [keysLoading, setKeysLoading] = useState(true);
    const [threadLoading, setThreadLoading] = useState(!initialThread);
    const loading = messagesLoading || keysLoading || threadLoading;
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!loading) {
            // Wait for next frame to ensure state updates are reflected
            const timer = requestAnimationFrame(() => {
                setIsReady(true);
            });
            return () => cancelAnimationFrame(timer);
        } else {
            setIsReady(false);
        }
    }, [loading]);

    const [editingTitle, setEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState(thread?.title || '');
    const [actionStatus, setActionStatus] = useState<'archive' | 'delete' | null>(null);
    const [currentPermission, setCurrentPermission] = useState<'VIEW' | 'INTERVENE' | null>(permission);
    const [queueNotice, setQueueNotice] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const apiKeyLast4 = apiKeys[getProvider(thread?.model || 'gpt-5.2')] || null;
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeySaving, setApiKeySaving] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Array<{ user_id: string; display_name: string; handle: string; avatar_path: string | null; permission: 'VIEW' | 'INTERVENE' }>>([]);
    const memberIds = useMemo(() => members.map((member) => member.user_id), [members]);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberSearchResult, setMemberSearchResult] = useState<{ user_id: string; display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [memberPermission, setMemberPermission] = useState<'VIEW' | 'INTERVENE'>('VIEW');
    const [memberError, setMemberError] = useState<string | null>(null);
    const [ownerProfile, setOwnerProfile] = useState<{ display_name: string; handle: string | null; avatar_path: string | null } | null>(null);
    const [readEnabled, setReadEnabled] = useState<boolean | null>(null);
    const [sourceRoomId, setSourceRoomId] = useState<string | null>(null);
    const [readRooms, setReadRooms] = useState<Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }>>([]);
    const [readRoomLoading, setReadRoomLoading] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareRooms, setShareRooms] = useState<Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }>>([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const menuContainerRef = useRef<HTMLDivElement | null>(null);
    const menuAnchorRef = useRef<DOMRect | null>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const [runningStartTime, setRunningStartTime] = useState<number | null>(null);
    const [runningTooLong, setRunningTooLong] = useState(false);
    const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string>('ユーザ');
    const [readToggleLoading, setReadToggleLoading] = useState(false);

    // Auto-scroll logic
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const queueKickRef = useRef(0);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);



    // Track running time and show warning after 30 seconds
    useEffect(() => {
        if (isRunning && !runningStartTime) {
            setRunningStartTime(Date.now());
            setRunningTooLong(false);
        } else if (!isRunning) {
            setRunningStartTime(null);
            setRunningTooLong(false);
        }
    }, [isRunning, runningStartTime]);

    useEffect(() => {
        if (!runningStartTime) return;

        const timer = setInterval(() => {
            const elapsed = Date.now() - runningStartTime;
            if (elapsed > 30000) { // 30 seconds
                setRunningTooLong(true);
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [runningStartTime]);
    const isArchived = Boolean(thread?.archived_at);
    const isEmbedded = variant === 'embedded';
    const canIntervene = isOwner || currentPermission === 'INTERVENE';
    const hasApiKey = Boolean(apiKeyLast4);
    const participantsMap = useMemo(() => {
        const map: Record<string, { display_name: string; avatar_path: string | null }> = {};
        if (ownerProfile && thread?.owner_user_id) {
            map[thread.owner_user_id] = ownerProfile;
        }
        members.forEach(m => {
            map[m.user_id] = m;
        });
        return map;
    }, [members, ownerProfile, thread?.owner_user_id]);

    const renderedMessages = useMemo(
        () => {
            // Deduplicate messages for display
            const uniqueMessages = messages.filter((msg, index) => {
                if (index === 0) return true;
                const prevMsg = messages[index - 1];

                // Remove if same ID
                if (msg.id === prevMsg.id) return false;

                // Remove if same role and same content (likely a duplicate insert or display bug)
                if (msg.role === prevMsg.role && msg.content === prevMsg.content) {
                    return false;
                }
                return true;
            });

            return uniqueMessages.map((msg) => {
                const isMe = msg.role === 'user' && msg.sender_user_id === userId;
                const isOther = msg.role === 'user' && !isMe;
                const isSystem = msg.role === 'system';

                let alignment = '';
                if (isSystem) alignment = 'justify-center';
                else if (isMe) alignment = 'justify-end';
                else alignment = 'justify-start';

                return (
                    <div key={msg.id} className={`flex ${alignment} mb-4 w-full`}>
                        {isSystem ? (
                            <div className="text-center py-2 px-4 text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 rounded-full">
                                {msg.content}
                            </div>
                        ) : isMe ? (
                            <div className="message-bubble-sent max-w-[80%]">
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>
                        ) : isOther ? (
                            <div className="flex flex-col gap-1 max-w-[80%] items-start">
                                {msg.sender_user_id && participantsMap[msg.sender_user_id] && (
                                    <div className="flex items-center gap-2 ml-1">
                                        <span className="text-xs text-surface-500 font-medium">
                                            {participantsMap[msg.sender_user_id].display_name}
                                        </span>
                                    </div>
                                )}
                                <div className="p-3 rounded-2xl bg-surface-200 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-tl-none">
                                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                </div>
                            </div>
                        ) : (
                            // Assistant
                            <div className="ai-message max-w-[90%]">
                                <div className="prose dark:prose-invert text-surface-900 dark:text-surface-100 prose-sm max-w-none break-words text-sm [&>p]:mb-2 [&>p:last-child]:mb-0">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={markdownComponents}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                );
            });
        },
        [messages, participantsMap, userId]
    );

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
        // Simple mobile check
        const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
        if (splitTabs.length > 0 && isMobile) {
            setTimeout(() => {
                scrollToBottom('auto');
            }, 500);
        }
    }, [splitTabs.length, scrollToBottom]);

    // Call edge function without relying on Supabase auth header (avoids Invalid JWT issues)
    const callFunction = useCallback(
        async (name: string, body: any) => {
            const functionsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!functionsUrl) {
                throw new Error('Supabase URL が設定されていません');
            }
            const res = await fetch(`${functionsUrl}/functions/v1/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
                    ...(userId ? { 'x-user-id': userId } : {}),
                },
                body: JSON.stringify(body || {}),
            });
            let data: any = null;
            try {
                data = await res.json();
            } catch {
                // ignore
            }
            if (!res.ok) {
                const message = data?.error || data?.msg || res.statusText;
                throw new Error(message || 'Edge Function error');
            }
            return data;
        },
        [userId]
    );

    const getAccessTokenOrThrow = useCallback(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data.session?.access_token;
        if (!token) throw new Error('Missing access token');
        return token;
    }, [supabase]);

    const kickQueue = useCallback(async () => {
        const now = Date.now();
        if (now - queueKickRef.current < 1500) return;
        queueKickRef.current = now;
        try {
            await callFunction('ai_process_queue', { threadId, userId });
        } catch (error) {
            console.error('Failed to process queue:', error);
        }
    }, [callFunction, threadId]);

    const fetchMembers = useCallback(async () => {
        if (!threadId) return;

        const { data: memberRows } = await supabase
            .from('ai_thread_members')
            .select('user_id, permission')
            .eq('thread_id', threadId);

        const memberIds = (memberRows || []).map((row: any) => row.user_id);

        let profilesById: Record<string, { user_id: string; display_name: string; handle: string; avatar_path: string | null }> = {};

        if (memberIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, display_name, handle, avatar_path')
                .in('user_id', memberIds);

            profilesById = (profiles || []).reduce((acc, profile: any) => {
                acc[profile.user_id] = profile;
                return acc;
            }, {} as Record<string, { user_id: string; display_name: string; handle: string; avatar_path: string | null }>);
        }

        const nicknameMap = new Map<string, string>();
        if (memberIds.length > 0) {
            const { data: requesterRows } = await supabase
                .from('friendships')
                .select('addressee_id, requester_nickname')
                .eq('requester_id', userId)
                .in('addressee_id', memberIds);

            const { data: addresseeRows } = await supabase
                .from('friendships')
                .select('requester_id, addressee_nickname')
                .eq('addressee_id', userId)
                .in('requester_id', memberIds);

            (requesterRows || []).forEach((row: any) => {
                if (row.requester_nickname) {
                    nicknameMap.set(row.addressee_id, row.requester_nickname);
                }
            });
            (addresseeRows || []).forEach((row: any) => {
                if (row.addressee_nickname) {
                    nicknameMap.set(row.requester_id, row.addressee_nickname);
                }
            });
        }

        const mapped = (memberRows || [])
            .filter((row: any) => row.user_id !== thread?.owner_user_id)
            .map((row: any) => {
                const profile = profilesById[row.user_id];
                if (!profile) return null;
                const customName = nicknameMap.get(row.user_id);
                return {
                    user_id: row.user_id,
                    display_name: customName || profile.display_name,
                    handle: profile.handle,
                    avatar_path: profile.avatar_path,
                    permission: row.permission as 'VIEW' | 'INTERVENE',
                };
            })
            .filter(Boolean) as Array<{ user_id: string; display_name: string; handle: string; avatar_path: string | null; permission: 'VIEW' | 'INTERVENE' }>;

        setMembers(mapped);

        if (thread?.owner_user_id) {
            const { data: owner } = await supabase
                .from('profiles')
                .select('display_name, handle, avatar_path')
                .eq('user_id', thread.owner_user_id)
                .maybeSingle();
            if (owner) {
                const customOwnerName = nicknameMap.get(thread.owner_user_id);
                setOwnerProfile({
                    ...(owner as any),
                    display_name: customOwnerName || (owner as any).display_name,
                });
            }
        }
    }, [supabase, threadId, thread?.owner_user_id]);

    useEffect(() => {
        if (isOwner) {
            setCurrentPermission('INTERVENE');
            return;
        }
        if (permission) {
            setCurrentPermission(permission);
            return;
        }

        const fetchPermission = async () => {
            const { data: membership } = await supabase
                .from('ai_thread_members')
                .select('permission')
                .eq('thread_id', threadId)
                .eq('user_id', userId)
                .maybeSingle();
            setCurrentPermission((membership as any)?.permission || 'VIEW');
        };

        fetchPermission();
    }, [supabase, threadId, userId, isOwner, permission]);

    useEffect(() => {
        if (!userId) return;
        let canceled = false;

        const loadApiKeys = async () => {
            const { data } = await supabase
                .from('user_llm_keys')
                .select('provider, key_last4')
                .eq('user_id', userId);

            if (!canceled && data) {
                const keys: Record<string, string> = {};
                data.forEach((row: any) => {
                    keys[row.provider] = row.key_last4;
                });
                setApiKeys(keys);
            }
            setKeysLoading(false);
        };

        loadApiKeys();

        return () => { canceled = true; };
    }, [supabase, userId]);

    useEffect(() => {
        const loadThread = async () => {
            const { data, error } = await supabase
                .from('ai_threads')
                .select('*')
                .eq('id', threadId)
                .single();

            if (data) {
                setThread(data);
                setIsOwner((data as any).owner_user_id === userId);
                setReadEnabled((data as any).read_enabled ?? null);
                setSourceRoomId((data as any).source_room_id ?? null);
            } else if (error) {
                console.error('Error loading thread:', error);
                // Try fallback to member check if direct access failed (e.g. shared thread)
                const { data: membership } = await supabase
                    .from('ai_thread_members')
                    .select('ai_threads!inner(*)')
                    .eq('thread_id', threadId)
                    .eq('user_id', userId)
                    .single();

                if (membership && (membership as any).ai_threads) {
                    const joined = Array.isArray((membership as any).ai_threads)
                        ? (membership as any).ai_threads[0]
                        : (membership as any).ai_threads;
                    setThread(joined as AIThread);
                    setReadEnabled((joined as any).read_enabled ?? null);
                    setSourceRoomId((joined as any).source_room_id ?? null);
                }
            }
            setThreadLoading(false);
        };

        if (threadId && !thread) {
            loadThread();
        } else if (thread) {
            setThreadLoading(false);
            setReadEnabled((thread as any).read_enabled ?? null);
            setSourceRoomId((thread as any).source_room_id ?? null);
        }
    }, [threadId, thread, supabase, userId]);

    // thread側の最新状態とUIの同期（トグル操作中は触らない）
    useEffect(() => {
        if (readToggleLoading) return;
        if (thread) {
            setReadEnabled((thread as any).read_enabled ?? null);
            setSourceRoomId((thread as any).source_room_id ?? null);
        }
    }, [thread?.read_enabled, thread?.source_room_id, readToggleLoading]);

    // Fetch owner profile
    useEffect(() => {
        if (thread?.owner_user_id) {
            const fetchOwner = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('display_name, avatar_path, handle')
                    .eq('user_id', thread.owner_user_id)
                    .single();
                if (data) {
                    setOwnerProfile(data);
                }
            };
            fetchOwner();
        }
    }, [thread?.owner_user_id, supabase]);

    // Current user display name for logs
    useEffect(() => {
        if (!userId) return;
        const loadMe = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle();
            const profile = data as { display_name?: string } | null;
            if (profile?.display_name) setCurrentUserDisplayName(profile.display_name);
        };
        loadMe();
    }, [supabase, userId]);



    // Message fetching error state
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Fetch messages
    useEffect(() => {
        const fetchMessages = async () => {
            setMessagesLoading(true);
            setFetchError(null);

            console.log('Fetching messages for thread:', threadId);
            // First try fetching messages without join to ensure access is allowed
            const { data: msgsData, error } = await supabase
                .from('ai_messages')
                .select('*')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            const msgs = msgsData as any[] | null;

            console.log('Fetched messages raw:', msgs?.length || 0, 'error:', error);

            if (error) {
                console.error('Error fetching messages:', error);
                setFetchError(`メッセージ取得エラー: ${error.message} (${error.code})`);
            } else if (msgs) {
                // Manually fetch profiles for senders
                const senderIds = Array.from(new Set(msgs.map(m => m.sender_user_id).filter(Boolean)));
                let profilesMap: Record<string, any> = {};

                if (senderIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('user_id, display_name')
                        .in('user_id', senderIds);

                    if (profiles) {
                        profiles.forEach((p: any) => {
                            profilesMap[p.user_id] = p;
                        });
                    }
                }

                const formattedMessages = msgs
                    .filter((msg: any) => !(typeof msg.content === 'string' && msg.content.trim().startsWith(CHAT_CONTEXT_PREFIX)))
                    .map((msg: any) => ({
                        ...msg,
                        sender_name: profilesMap[msg.sender_user_id]?.display_name || null
                    }));

                setMessages(formattedMessages);
            }

            // Check if there's a running run
            const { data: runningRun } = await supabase
                .from('ai_runs')
                .select('id')
                .eq('thread_id', threadId)
                .eq('status', 'running')
                .single();

            if (runningRun) {
                addRunningThread(threadId);
            } else {
                kickQueue();
            }

            setMessagesLoading(false);
        };

        if (threadId) {
            fetchMessages();
        }
    }, [threadId, supabase, kickQueue, addRunningThread]);

    // Realtime subscription
    useEffect(() => {
        if (!threadId) return;

        // Subscribe to messages
        const messagesChannel = supabase
            .channel(`ai_messages:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_messages',
                    filter: `thread_id=eq.${threadId}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as any;
                        setMessages((prev) => {
                            // Deduplicate
                            if (prev.some(m => m.id === newMessage.id)) return prev;
                            // Remove optimistic
                            const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                            if (typeof newMessage.content === 'string' && newMessage.content.trim().startsWith(CHAT_CONTEXT_PREFIX)) {
                                return filtered;
                            }
                            return [...filtered, newMessage];
                        });

                        // If user message inserted, kick queue
                        if (newMessage.role === 'user') {
                            kickQueue();
                        }
                    }
                }
            )
            .subscribe();

        // Subscribe to stream events
        const streamChannel = supabase
            .channel(`ai_stream:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ai_stream_events',
                    filter: `thread_id=eq.${threadId}`,
                },
                (payload) => {
                    const event = payload.new as any;
                    setStreamingContent(threadId, (prev: string) => (prev || '') + event.delta);
                }
            )
            .subscribe();

        // Subscribe to run status
        const runChannel = supabase
            .channel(`ai_runs:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_runs',
                    filter: `thread_id=eq.${threadId}`,
                },
                (payload) => {
                    const run = payload.new as any;
                    if (run.status === 'running') {
                        addRunningThread(threadId);
                    } else {
                        removeRunningThread(threadId);
                        setStreamingContent(threadId, '');
                        // If run finished/failed, kick queue to process next
                        kickQueue();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(streamChannel);
            supabase.removeChannel(runChannel);
        };
    }, [supabase, threadId, addRunningThread, removeRunningThread, setStreamingContent]);

    // Update thread metadata real-time
    useEffect(() => {
        if (!threadId) return;

        const channel = supabase
            .channel(`ai_thread_meta:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_threads',
                    filter: `id=eq.${threadId}`,
                },
                (payload) => {
                    const updated = payload.new as any;
                    setThread((prev: any) => ({
                        ...prev,
                        title: updated.title,
                        model: updated.model,
                        updated_at: updated.updated_at,
                        archived_at: updated.archived_at
                    }));
                    if (!editingTitle) {
                        setNewTitle(updated.title);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, threadId, editingTitle]);

    useEffect(() => {
        const channel = supabase
            .channel(`ai_members:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_thread_members',
                    filter: `thread_id=eq.${threadId}`,
                },
                (payload) => {
                    const record = (payload.new || payload.old) as any;
                    if (record?.user_id === userId) {
                        if (payload.eventType === 'DELETE') {
                            setCurrentPermission(null);
                        } else if (payload.new) {
                            setCurrentPermission((payload.new as any).permission);
                        }
                    }
                    if (isOwner) {
                        fetchMembers();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, threadId, userId, fetchMembers, isOwner]);

    // Scroll on new messages
    useEffect(() => {
        if (messages.length > 0 || currentStream) {
            if (!initialScrollDone.current) {
                // Initial load: jump to bottom
                scrollToBottom('auto');
                initialScrollDone.current = true;
            } else {
                // New messages: smooth scroll
                scrollToBottom('smooth');
            }
        }
    }, [messages, currentStream, scrollToBottom]);

    useEffect(() => {
        if (threadId) {
            fetchMembers();
        }
    }, [threadId, fetchMembers]);

    useEffect(() => {
        if (!threadId) return;

        const channel = supabase
            .channel(`ai_thread_profiles:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                },
                (payload) => {
                    const updatedUserId = (payload.new || payload.old)?.user_id;
                    if (!updatedUserId) return;
                    if (updatedUserId === thread?.owner_user_id || memberIds.includes(updatedUserId)) {
                        fetchMembers();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, threadId, thread?.owner_user_id, memberIds, fetchMembers]);

    useEffect(() => {
        if (!threadId || !userId) return;

        const requesterChannel = supabase
            .channel(`ai_friendships_requester_${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `requester_id=eq.${userId}`,
                },
                (payload: any) => {
                    const otherId = payload.new?.addressee_id || payload.old?.addressee_id;
                    if (!otherId) return;
                    if (memberIds.includes(otherId) || otherId === thread?.owner_user_id) {
                        fetchMembers();
                    }
                }
            )
            .subscribe();

        const addresseeChannel = supabase
            .channel(`ai_friendships_addressee_${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `addressee_id=eq.${userId}`,
                },
                (payload: any) => {
                    const otherId = payload.new?.requester_id || payload.old?.requester_id;
                    if (!otherId) return;
                    if (memberIds.includes(otherId) || otherId === thread?.owner_user_id) {
                        fetchMembers();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(requesterChannel);
            supabase.removeChannel(addresseeChannel);
        };
    }, [supabase, threadId, userId, memberIds, thread?.owner_user_id, fetchMembers]);

    useEffect(() => {
        if (!headerMenuOpen || !menuContainerRef.current || !menuAnchorRef.current) return;
        const frame = requestAnimationFrame(() => {
            const anchor = menuAnchorRef.current!;
            const menuRect = menuContainerRef.current!.getBoundingClientRect();
            const margin = 8;

            let left = anchor.right - menuRect.width;
            let top = anchor.bottom + 8;

            if (left < margin) left = margin;
            if (left + menuRect.width > window.innerWidth - margin) {
                left = window.innerWidth - menuRect.width - margin;
            }

            if (top + menuRect.height > window.innerHeight - margin) {
                top = anchor.top - menuRect.height - 8;
            }
            if (top < margin) top = margin;

            setMenuStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 9999,
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [headerMenuOpen]);

    // Scroll handling
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollToBottom(!isNearBottom);
    };

    const handleInputChange = (value: string) => {
        setInput(value);
        if (inputRef.current) {
            inputRef.current.style.height = '38px'; // Reset
            const scrollHeight = inputRef.current.scrollHeight;
            inputRef.current.style.height = Math.min(scrollHeight, 128) + 'px';
        }
    };

    // Send message
    const handleSend = async () => {
        if (!input.trim() || sending || isRunning || isArchived || !canIntervene) return;
        if (isOwner && !hasApiKey) {
            handleOpenApiKeyModal();
            return;
        }

        const content = input.trim();
        setInput('');
        setSending(true);

        try {
            // Add user message optimistically
            const tempId = `temp-${Date.now()}`;
            setMessages((prev) => [
                ...prev,
                {
                    id: tempId,
                    role: 'user',
                    content,
                    sender_kind: isOwner ? 'owner' : 'collaborator',
                    sender_user_id: userId,
                    created_at: new Date().toISOString(),
                },
            ]);

            setStreamingContent(threadId, '');
            addRunningThread(threadId);

            // For v2 encrypted keys, we need to decrypt client-side and pass to server
            let decryptedApiKey: string | undefined;
            try {
                const provider = (thread?.model || 'gpt-5.2').startsWith('gemini') ? 'google' : 'openai';

                // Check if user has a local encryption key (v2 format)
                const { hasEncryptionKey, decryptApiKeyClientSide } = await import('@/lib/crypto');

                if (hasEncryptionKey(userId)) {
                    // Get the encrypted key from DB
                    const { data: keyData } = await supabase
                        .from('user_llm_keys')
                        .select('encrypted_key')
                        .eq('user_id', userId)
                        .eq('provider', provider)
                        .maybeSingle();

                    const encryptedKey = (keyData as { encrypted_key?: string } | null)?.encrypted_key;
                    if (encryptedKey?.startsWith('v2:')) {
                        // Client-encrypted - decrypt locally
                        decryptedApiKey = await decryptApiKeyClientSide(encryptedKey, userId) || undefined;
                    }
                }
            } catch (e) {
                console.error('Failed to decrypt API key locally:', e);
                // Continue without - server may have v1 key that it can decrypt
            }

            // Call Edge Function
            const { data, error } = await callFunction('ai_send_message', {
                threadId,
                content,
                kind: isOwner ? 'owner' : 'collaborator',
                ...(decryptedApiKey && { apiKey: decryptedApiKey }), // Pass decrypted key if available
                userId,
            });

            if (error) {
                console.error('Failed to send message:', error);
                alert(`メッセージ送信エラー: ${error.message || JSON.stringify(error)}`);

                if (error.message?.toLowerCase().includes('api key')) {
                    handleOpenApiKeyModal();
                }
                removeRunningThread(threadId);
                // Remove optimistic message
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                setInput(content);
                return;
            }

            if (data?.error) {
                console.error('Server returned error:', data.error);
                alert(`サーバーエラー: ${data.error} \n詳細: ${JSON.stringify(data.details)}`);
                removeRunningThread(threadId);
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                setInput(content);
                return;
            }

            if (data?.queued) {
                setQueueNotice('キューに追加しました');
                setTimeout(() => setQueueNotice(null), 3000);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            removeRunningThread(threadId);
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

    const handleDuplicate = async () => {
        const accessToken = await getAccessTokenOrThrow();

        const { data, error } = await supabase.functions.invoke('ai_duplicate_thread', {
            body: { threadId },
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });

        if (error || !data?.newThreadId) {
            alert('複製に失敗しました');
            return;
        }

        router.push(`/ai/${data.newThreadId}`);
        router.refresh();
    };

    const handleLeaveThread = async () => {
        if (!confirm('このスレッドを非表示にしますか？\n（共有メンバーから外れます）')) return;

        try {
            const { error } = await supabase
                .from('ai_thread_members')
                .delete()
                .eq('thread_id', threadId)
                .eq('user_id', userId);

            if (error) throw error;

            router.push('/ai');
            router.refresh();
        } catch (error) {
            console.error('Failed to leave thread:', error);
            alert('操作に失敗しました');
        }
    };

    const handleOpenApiKeyModal = () => {
        setApiKeyError(null);
        setApiKeyInput('');
        setApiKeyModalOpen(true);
    };

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) {
            setApiKeyError('APIキーを入力してください');
            return;
        }

        setApiKeySaving(true);
        setApiKeyError(null);

        const provider = (thread?.model || 'gpt-5.2').startsWith('gemini') ? 'google' : 'openai';
        const rawKey = apiKeyInput.trim();
        const last4 = rawKey.slice(-4);

        try {
            // Import crypto utilities dynamically (only available in browser)
            const { encryptApiKeyClientSide } = await import('@/lib/crypto');

            // Encrypt client-side - server will never see the raw key
            const encryptedKey = await encryptApiKeyClientSide(rawKey, userId);

            const accessToken = await getAccessTokenOrThrow();

            const { data, error } = await supabase.functions.invoke('key_set', {
                body: {
                    apiKey: encryptedKey,  // Already encrypted
                    provider,
                    last4  // Send last4 separately since server can't extract it
                },
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });

            if (error) {
                console.error('Failed to save API key:', error);
                const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
                setApiKeyError(`保存に失敗しました: ${errorMsg}`);
                return;
            }

            setApiKeys(prev => ({ ...prev, [provider]: data?.last4 || last4 }));
            setApiKeyModalOpen(false);
            setApiKeyInput('');
        } catch (e: any) {
            console.error('Exception saving API key:', e);
            setApiKeyError(`保存に失敗しました: ${e.message || '不明なエラー'}`);
        } finally {
            setApiKeySaving(false);
        }
    };

    const handleUpdateModel = async (modelId: string) => {
        if (!threadId) return;

        const previousModel = thread?.model;
        // Optimistic update
        setThread((prev: any) => ({ ...prev, model: modelId }));

        const { error } = await (supabase
            .from('ai_threads') as any)
            .update({ model: modelId })
            .eq('id', threadId);

        if (error) {
            console.error('Failed to update model:', error);
            // Revert
            setThread((prev: any) => ({ ...prev, model: previousModel }));
            alert('モデルの変更に失敗しました');
        }
    };

    const fetchShareRooms = useCallback(async () => {
        setShareLoading(true);
        setShareError(null);
        setReadRoomLoading(true);

        try {
            const { data: summaries, error } = await supabase
                .from('room_summaries')
                .select('room_id, room_name, room_avatar_path, room_type')
                .eq('user_id', userId);

            if (error) throw error;

            const roomList = (summaries || []).map((summary: any) => ({
                id: summary.room_id,
                name: summary.room_name || '名称未設定トーク',
                avatar_path: summary.room_avatar_path,
                type: summary.room_type as 'dm' | 'group',
            }));

            setShareRooms(roomList);
            // readRooms はスレッド共有先に限定するので、別で取得
        } catch (e) {
            console.error('Failed to fetch rooms:', e);
            setShareError('ルーム一覧の取得に失敗しました');
        } finally {
            setShareLoading(false);
            setReadRoomLoading(false);
        }
    }, [supabase, userId, setShareRooms, setShareError]);

    // スレッドが共有されている＆ユーザが参加しているトークのみ取得
    const fetchReadableRooms = useCallback(async () => {
        setReadRoomLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('room_id, rooms:rooms(id, group_id, type, name:room_name, avatar_path:room_avatar_path), room_members!inner(user_id)')
                .eq('kind', 'shared_ai_thread')
                .eq('room_members.user_id', userId)
                .eq('content->>threadId', threadId);

            if (error) throw error;

            const filtered = (data || [])
                .map((row: any) => ({
                    id: row.room_id,
                    name: row.rooms?.name || '名称未設定トーク',
                    avatar_path: row.rooms?.avatar_path || null,
                    type: row.rooms?.type || 'dm',
                })) as Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }>;

            // fallback: 共有先が0件の場合は自分が所属するトーク一覧を使う
            setReadRooms(filtered.length > 0 ? filtered : shareRooms);
        } catch (e) {
            console.error('Failed to fetch readable rooms:', e);
            setReadRooms(shareRooms);
        } finally {
            setReadRoomLoading(false);
        }
    }, [supabase, userId, threadId, shareRooms]);

    useEffect(() => {
        if (!supabase || !userId) return;
        fetchShareRooms();
    }, [supabase, userId, fetchShareRooms]);

    useEffect(() => {
        if (!supabase || !userId || !threadId) return;
        fetchReadableRooms();
    }, [supabase, userId, threadId, fetchReadableRooms]);

    const handleShareToRoom = async (roomId: string) => {
        if (!thread) return;

        const content = createSharedAIThreadCard(threadId, thread.owner_user_id, thread.title || 'AIスレッド');
        const { error } = await supabase.from('messages').insert({
            room_id: roomId,
            sender_user_id: userId,
            kind: 'shared_ai_thread',
            content,
        } as any);

        if (error) {
            setShareError('共有に失敗しました');
            return;
        }

        // Set default read target to this room when shared from thread view
        await (supabase
            .from('ai_threads') as any)
            .update({ source_room_id: roomId, read_enabled: true })
            .eq('id', threadId)
            .is('source_room_id', null);

        // Try to add members (best effort)
        try {
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id')
                .eq('room_id', roomId);

            const userIds = (members || [])
                .map((m: any) => m.user_id)
                .filter((id: string) => id && id !== thread.owner_user_id);

            if (userIds.length > 0) {
                await (supabase
                    .from('ai_thread_members') as any)
                    .upsert(
                        userIds.map((id: string) => ({
                            thread_id: threadId,
                            user_id: id,
                            permission: 'VIEW',
                        })),
                        { onConflict: 'thread_id,user_id' }
                    );
            }
        } catch (err) {
            console.error('Failed to add members:', err);
        }

        setShareOpen(false);
    };

    const handleSearchMember = async () => {
        if (!memberSearch.trim()) return;
        setMemberError(null);
        setMemberSearchResult(null);

        const handle = memberSearch.trim().replace('@', '').toLowerCase();
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, display_name, handle, avatar_path')
            .eq('handle', handle)
            .maybeSingle();

        if (!profile) {
            setMemberError('ユーザーが見つかりません');
            return;
        }

        if (thread?.owner_user_id === (profile as any).user_id) {
            setMemberError('オーナーは既に参加しています');
            return;
        }

        if (members.some((m) => m.user_id === (profile as any).user_id)) {
            setMemberError('既に追加済みです');
            return;
        }

        setMemberSearchResult(profile as any);
    };

    const logAIEvent = async (content: string) => {
        if (!threadId) return;
        try {
            await supabase.from('ai_messages').insert({
                thread_id: threadId,
                role: 'system',
                sender_user_id: userId,
                sender_kind: 'system',
                content,
            } as any);
        } catch (err) {
            console.error('Failed to write AI thread log:', err);
        }
    };

    const fetchCustomDisplayName = async (targetUserId: string) => {
        if (!targetUserId) return 'Unknown';

        const { data: requesterRow } = await supabase
            .from('friendships')
            .select('requester_nickname')
            .eq('requester_id', userId)
            .eq('addressee_id', targetUserId)
            .maybeSingle();

        const requester = requesterRow as { requester_nickname?: string | null } | null;
        if (requester?.requester_nickname) {
            return requester.requester_nickname;
        }

        const { data: addresseeRow } = await supabase
            .from('friendships')
            .select('addressee_nickname')
            .eq('addressee_id', userId)
            .eq('requester_id', targetUserId)
            .maybeSingle();

        const addressee = addresseeRow as { addressee_nickname?: string | null } | null;
        if (addressee?.addressee_nickname) {
            return addressee.addressee_nickname;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', targetUserId)
            .maybeSingle();

        const resolvedProfile = profile as { display_name?: string | null } | null;
        return resolvedProfile?.display_name || 'Unknown';
    };

    const discardPendingQueue = async (targetUserId: string) => {
        await (supabase
            .from('ai_queue_items') as any)
            .update({
                status: 'discarded',
                discarded_at: new Date().toISOString(),
            })
            .eq('thread_id', threadId)
            .eq('user_id', targetUserId)
            .eq('status', 'pending');
    };

    const handleAddMember = async () => {
        if (!memberSearchResult) return;
        setMemberError(null);

        const { error } = await (supabase
            .from('ai_thread_members') as any)
            .insert({
                thread_id: threadId,
                user_id: memberSearchResult.user_id,
                permission: memberPermission,
            });

        if (error) {
            setMemberError('メンバー追加に失敗しました');
            return;
        }

        setMemberSearch('');
        setMemberSearchResult(null);
        setMemberPermission('VIEW');
        fetchMembers();
        const targetName = await fetchCustomDisplayName(memberSearchResult.user_id);
        const actorName = await fetchCustomDisplayName(userId);
        await logAIEvent(`${targetName}を${actorName}が追加しました`);
    };

    const handleUpdateMemberPermission = async (targetUserId: string, nextPermission: 'VIEW' | 'INTERVENE') => {
        const { error } = await (supabase
            .from('ai_thread_members') as any)
            .update({ permission: nextPermission })
            .eq('thread_id', threadId)
            .eq('user_id', targetUserId);

        if (error) {
            setMemberError('権限更新に失敗しました');
            return;
        }

        if (nextPermission === 'VIEW') {
            await discardPendingQueue(targetUserId);
        }

        fetchMembers();
        const actorName = await fetchCustomDisplayName(userId);
        const targetName = await fetchCustomDisplayName(targetUserId);
        const label = nextPermission === 'VIEW' ? '閲覧のみ' : '閲覧・操作';
        await logAIEvent(`${targetName}の権限を${actorName}が${label}に変更しました`);
    };

    const handleRemoveMember = async (targetUserId: string) => {
        const { error } = await (supabase
            .from('ai_thread_members') as any)
            .delete()
            .eq('thread_id', threadId)
            .eq('user_id', targetUserId);

        if (error) {
            setMemberError('メンバー削除に失敗しました');
            return;
        }

        await discardPendingQueue(targetUserId);
        fetchMembers();
        const actorName = await fetchCustomDisplayName(userId);
        const targetName = await fetchCustomDisplayName(targetUserId);
        if (targetUserId === userId) {
            await logAIEvent(`メンバーが退出しました: ${targetName}`);
        } else {
            await logAIEvent(`${targetName}を${actorName}が削除しました`);
        }
    };

    // Update title
    const handleUpdateTitle = async () => {
        if (isArchived) {
            setEditingTitle(false);
            return;
        }
        if (!newTitle.trim() || newTitle === thread?.title) {
            setEditingTitle(false);
            return;
        }

        await (supabase
            .from('ai_threads') as any)
            .update({ title: newTitle.trim() })
            .eq('id', threadId);

        setThread((prev) => (prev ? { ...prev, title: newTitle.trim() } : prev));
        setEditingTitle(false);
    };

    const handleArchive = async () => {
        if (isArchived) return;
        if (!confirm('このスレッドをアーカイブしますか？')) return;

        setActionStatus('archive');
        const archivedAt = new Date().toISOString();
        const { error } = await (supabase
            .from('ai_threads') as any)
            .update({ archived_at: archivedAt })
            .eq('id', threadId);

        if (error) {
            alert('アーカイブに失敗しました');
            setActionStatus(null);
            return;
        }

        setThread((prev) => (prev ? { ...prev, archived_at: archivedAt } : prev));
        router.push('/ai');
        router.refresh();
    };

    const handleDelete = async () => {
        if (!confirm('このスレッドを削除しますか？この操作は取り消せません。')) return;

        setActionStatus('delete');
        const { error } = await (supabase
            .from('ai_threads') as any)
            .delete()
            .eq('id', threadId);

        if (error) {
            alert('削除に失敗しました');
            setActionStatus(null);
            return;
        }

        router.push('/ai');
        router.refresh();
    };

    // Copy share link
    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/ai/${threadId}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('共有リンクをコピーしました');
    };

    // Read settings handlers (thread side)
    const handleUpdateReadTarget = useCallback(
        async (roomId: string) => {
            if (!threadId || !roomId) return;
            // 読込先候補外は無視
            if (readRooms.length > 0 && !readRooms.some((r) => r.id === roomId)) return;
            const prevRoomId = sourceRoomId || (thread as any)?.source_room_id || null;
            try {
                await (supabase
                    .from('ai_threads') as any)
                    .update({ source_room_id: roomId, read_enabled: readEnabled ?? true })
                    .eq('id', threadId);
                setSourceRoomId(roomId);
                setThread((prev: any) => prev ? { ...prev, source_room_id: roomId, read_enabled: (readEnabled ?? true) } : prev);
                if (readEnabled === null) setReadEnabled(true);

                // ONログは読取が有効な場合のみ
                if (readEnabled ?? true) {
                    await supabase.from('messages').insert({
                        room_id: roomId,
                        sender_user_id: userId,
                        kind: 'system',
                        content: `${currentUserDisplayName}がスレッド「${thread?.title || 'AIスレッド'}」の読取をオンにしました`,
                    } as any);
                }

                // 以前の読込先があれば、そちらにオフのログを残す
                if (prevRoomId && prevRoomId !== roomId) {
                    await supabase.from('messages').insert({
                        room_id: prevRoomId,
                        sender_user_id: userId,
                        kind: 'system',
                        content: `${currentUserDisplayName}がスレッド「${thread?.title || 'AIスレッド'}」の読取をオフにしました`,
                    } as any);
                }
            } catch (e) {
                console.error('Failed to update read target', e);
                // 失敗時リカバリ
                const { data } = await supabase
                    .from('ai_threads')
                    .select('source_room_id, read_enabled')
                    .eq('id', threadId)
                    .single();
                const threadData = data as { source_room_id?: string | null; read_enabled?: boolean } | null;
                if (threadData) {
                    setSourceRoomId(threadData.source_room_id ?? prevRoomId);
                    setReadEnabled(threadData.read_enabled ?? readEnabled);
                    setThread((prev: any) => prev ? { ...prev, ...threadData } : prev);
                }
            }
        },
        [supabase, threadId, readEnabled, readRooms, userId, currentUserDisplayName, thread?.title, thread, sourceRoomId]
    );

    const handleToggleReadEnabled = useCallback(
        async (next: boolean) => {
            if (!threadId) return;
            // 読込先の優先候補: 現在選択中 → スレッド既存の source → 読込候補一覧の先頭
            const targetRoom = sourceRoomId || (thread as any)?.source_room_id || (readRooms.length > 0 ? readRooms[0].id : null);
            const prevEnabled = readEnabled ?? false;
            const prevSource = sourceRoomId || (thread as any)?.source_room_id || null;
            if (!targetRoom && next) {
                console.warn('読取をONにするには読込先トークが必要です');
                setReadEnabled(prevEnabled);
                return; // ON 時は読込先必須
            }
            // ボタン表示を即時反映
            setReadEnabled(next);
            setReadToggleLoading(true);
            try {
                await (supabase
                    .from('ai_threads') as any)
                    .update({
                        read_enabled: next,
                        ...(targetRoom ? { source_room_id: targetRoom } : {}),
                    })
                    .eq('id', threadId);
                if (targetRoom && next) setSourceRoomId(targetRoom);
                // threadステートも即時更新して揺れを抑える
                setThread((prev: any) => prev ? { ...prev, read_enabled: next, source_room_id: targetRoom ?? prev.source_room_id } : prev);

                if (targetRoom) {
                    await supabase.from('messages').insert({
                        room_id: targetRoom,
                        sender_user_id: userId,
                        kind: 'system',
                        content: `${currentUserDisplayName}がスレッド「${thread?.title || 'AIスレッド'}」の読取を${next ? 'オン' : 'オフ'}にしました`,
                    } as any);
                }
            } catch (e) {
                console.error('Failed to toggle read enabled', e);
                // 失敗したら元に戻す
                setReadEnabled(prevEnabled);
                setSourceRoomId(prevSource);
                // 最新のDB状態に合わせて再フェッチ
                const { data } = await supabase
                    .from('ai_threads')
                    .select('read_enabled, source_room_id')
                    .eq('id', threadId)
                    .single();
                const threadData = data as { source_room_id?: string | null; read_enabled?: boolean } | null;
                if (threadData) {
                    setReadEnabled(threadData.read_enabled ?? prevEnabled);
                    setSourceRoomId(threadData.source_room_id ?? prevSource);
                    setThread((prev: any) => prev ? { ...prev, ...threadData } : prev);
                }
            } finally {
                setReadToggleLoading(false);
            }
        },
        [supabase, threadId, sourceRoomId, readRooms, currentUserDisplayName, thread?.title, userId, thread, readEnabled]
    );

    const MODEL_OPTIONS = [
        { id: 'gpt-5.2', label: 'OpenAI (GPT-5.2)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ];



    return (
        <div className="flex flex-col h-full relative overflow-hidden">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 h-14 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 sticky top-0 z-20">
                {!isEmbedded ? (
                    <Link href="/ai" className="md:hidden btn-icon">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                ) : (
                    // UI-007: Close split view
                    <button
                        onClick={() => {
                            const tabs = useSplitStore.getState().tabs;
                            const myTab = tabs.find((t) => t.threadId === threadId);
                            if (myTab) useSplitStore.getState().removeTab(myTab.tabId);
                        }}
                        className="md:hidden btn-icon text-surface-500"
                        title="閉じる"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    {editingTitle ? (
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onBlur={handleUpdateTitle}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                            className="w-full py-1.5 px-4 text-lg font-semibold rounded-full bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 transition-all outline-none shadow-sm"
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold truncate">{thread?.title || 'AIスレッド'}</h2>
                            {isOwner && (
                                <button
                                    onClick={() => {
                                        setNewTitle(thread?.title || '');
                                        setEditingTitle(true);
                                    }}
                                    className="btn-icon p-1"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            )}
                            {isArchived && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                                    アーカイブ済み
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-surface-500 mt-1.5 leading-none min-w-0">
                        {isOwner ? (
                            <div className="relative flex items-center min-w-0">
                                <select
                                    value={thread?.model || 'gpt-5.2'}
                                    onChange={(e) => handleUpdateModel(e.target.value)}
                                    className="appearance-none bg-transparent border-none p-0 pr-4 text-xs font-medium text-surface-900 dark:text-surface-200 focus:ring-0 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[160px] md:max-w-[220px]"
                                >
                                    {MODEL_OPTIONS.map((option) => {
                                        return (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        );
                                    })}
                                    {thread?.model && !MODEL_OPTIONS.some((o) => o.id === thread.model) && (
                                        <option value={thread.model}>
                                            {thread.model.startsWith('gemini') ? 'Gemini API' : 'OpenAI API'}
                                        </option>
                                    )}
                                </select>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-2.5 h-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </div>
                            </div>
                        ) : (
                            <span className="truncate max-w-[160px] md:max-w-[220px] font-medium text-surface-900 dark:text-surface-200">
                                {MODEL_OPTIONS.find((o) => o.id === thread?.model)?.label ||
                                    (thread?.model?.startsWith('gemini') ? 'Gemini API' : 'OpenAI API')}
                            </span>
                        )}

                        <span
                            className={cn(
                                "truncate max-w-[140px] md:max-w-[180px] text-[10px] px-1.5 py-0.5 rounded-full border shrink-0",
                                isOwner && hasApiKey
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                    : isOwner
                                        ? "bg-surface-100 text-surface-500 border-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:border-surface-700"
                                        : "bg-surface-100 text-emerald-600 border-surface-200 dark:bg-surface-800 dark:text-emerald-400 dark:border-surface-700"
                            )}
                        >
                            {isOwner
                                ? (hasApiKey ? 'あなたのAPI' : '⚠️ API未登録')
                                : 'オーナーのAPIで実行'}
                        </span>

                        {thread?.created_at && (
                            <span className="whitespace-nowrap font-mono opacity-80 shrink-0">
                                {new Date(thread.created_at).toLocaleDateString('ja-JP')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="relative">
                    <button
                        ref={menuButtonRef}
                        onClick={() => {
                            if (!headerMenuOpen && menuButtonRef.current) {
                                const rect = menuButtonRef.current.getBoundingClientRect();
                                const menuWidth = 224;
                                menuAnchorRef.current = rect;
                                setMenuStyle({
                                    position: 'fixed',
                                    top: `${rect.bottom + 8}px`,
                                    left: `${rect.right - menuWidth}px`,
                                    zIndex: 9999,
                                });
                                setHeaderMenuOpen(true);
                            } else {
                                setHeaderMenuOpen(false);
                            }
                        }}
                        className="btn-icon p-1.5"
                        title="メニュー"
                    >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>

                    {headerMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-[9998]" onClick={() => setHeaderMenuOpen(false)} />
                            <div
                                ref={menuContainerRef}
                                className="absolute w-56 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden py-1"
                                style={menuStyle}
                            >
                                <button
                                    onClick={() => {
                                        handleDuplicate();
                                        setHeaderMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                >
                                    <DuplicateIcon className="w-4 h-4 text-surface-500" />
                                    <span>複製して新規作成</span>
                                </button>

                                <div className="h-px bg-surface-100 dark:bg-surface-700 my-1" />

                                {/* Read settings */}
                                <div className="px-4 py-3 text-sm space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-surface-600 dark:text-surface-300">読取を許可</span>
                                        <button
                                            onClick={() => handleToggleReadEnabled(!(readEnabled ?? true))}
                                            disabled={readToggleLoading || readRoomLoading || (!readEnabled && !sourceRoomId && readRooms.length === 0)}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${ (readEnabled ?? true) ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300'} ${readToggleLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            {(readEnabled ?? true) ? 'オン' : 'オフ'}
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[12px] text-surface-500">読込先トーク</div>
                                        <select
                                            value={sourceRoomId || ''}
                                            onChange={(e) => handleUpdateReadTarget(e.target.value)}
                                            disabled={readRoomLoading || (readRooms.length === 0) || readToggleLoading}
                                            className="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                                        >
                                            {readRooms.length === 0 && <option value="">選択できるトークがありません</option>}
                                            {readRooms.map((room) => (
                                                <option key={room.id} value={room.id}>
                                                    {room.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="text-[12px] text-surface-500 flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-1">
                                                <span className="text-surface-400">モデル:</span>
                                                <span className="font-medium">{thread?.model || '未設定'}</span>
                                            </span>
                                            {thread?.created_at && (
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-surface-400">共有日時:</span>
                                                    <span className="font-mono">{new Date(thread.created_at).toLocaleDateString('ja-JP')}</span>
                                                </span>
                                            )}
                                            {ownerProfile?.display_name && (
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="text-surface-400">オーナー:</span>
                                                    <span className="font-medium">{ownerProfile.display_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-surface-100 dark:bg-surface-700 my-1" />

                                {/* Share to Chat - Available to everyone */}
                                <button
                                    onClick={() => {
                                        setShareOpen(true);
                                        fetchShareRooms();
                                        setHeaderMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                >
                                    <ShareToChatIcon className="w-4 h-4 text-surface-500" />
                                    <span>トークに共有</span>
                                </button>

                                {isOwner && (
                                    <>
                                        <button
                                            onClick={() => {
                                                handleShare();
                                                setHeaderMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                        >
                                            <ShareIcon className="w-4 h-4 text-surface-500" />
                                            <span>リンクをコピー</span>
                                        </button>

                                        <div className="h-px bg-surface-100 dark:bg-surface-700 my-1" />
                                        <button
                                            onClick={() => {
                                                setMembersOpen(true);
                                                setHeaderMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                        >
                                            <UsersIcon className="w-4 h-4 text-surface-500" />
                                            <span>メンバー管理</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleOpenApiKeyModal();
                                                setHeaderMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                        >
                                            <KeyIcon className="w-4 h-4 text-surface-500" />
                                            <span>APIキー設定</span>
                                        </button>

                                        <div className="h-px bg-surface-100 dark:bg-surface-700 my-1" />
                                        {!isArchived && (
                                            <button
                                                onClick={() => {
                                                    handleArchive();
                                                    setHeaderMenuOpen(false);
                                                }}
                                                disabled={actionStatus === 'archive'}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-warning-600 dark:text-warning-500"
                                            >
                                                <ArchiveIcon className="w-4 h-4" />
                                                <span>アーカイブ</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                handleDelete();
                                                setHeaderMenuOpen(false);
                                            }}
                                            disabled={actionStatus === 'delete'}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors text-error-600 dark:text-error-400"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            <span>スレッドを削除</span>
                                        </button>
                                    </>
                                )}
                                {!isOwner && (
                                    <>
                                        <div className="h-px bg-surface-100 dark:bg-surface-700 my-1" />
                                        <button
                                            onClick={() => {
                                                handleLeaveThread();
                                                setHeaderMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                            <span>非表示にする</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Fetch Error Display */}
            {fetchError && (
                <div className="p-4 bg-red-50 border-b border-red-200">
                    <p className="text-sm text-red-600 font-medium">
                        エラーが発生しました: {fetchError}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                        ページを再読み込みするか、しばらく経ってからお試しください。
                    </p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                {!isReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface-900 z-10">
                        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-4 pt-4 pb-24 space-y-4"
                >
                    {isArchived && (
                        <div className="text-center py-2 text-sm text-surface-500">
                            このスレッドはアーカイブされています。
                        </div>
                    )}
                    {currentPermission === null && (
                        <div className="text-center py-2 text-sm text-error-500">
                            アクセス権がありません。
                        </div>
                    )}
                    {!isOwner && currentPermission === 'VIEW' && (
                        <div className="text-center py-2 text-sm text-surface-500">
                            閲覧のみの権限です。介入するには権限が必要です。
                        </div>
                    )}
                    {isReady && messages.length === 0 && !currentStream && (
                        <div className="text-center py-8 text-surface-400">
                            <p>メッセージがありません</p>
                            <p className="text-sm mt-1">AIに質問してみましょう</p>
                        </div>
                    )}

                    {renderedMessages}

                    {/* Streaming response */}
                    {/* Streaming response */}
                    {isRunning && currentStream && (!messages.length || messages[messages.length - 1].role !== 'assistant') && (
                        <div className="ai-message max-w-[90%]">
                            <div className="prose dark:prose-invert prose-sm max-w-none break-words text-sm [&>p]:mb-2 [&>p:last-child]:mb-0">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {currentStream}
                                </ReactMarkdown>
                                <span className="inline-block w-2 h-4 bg-accent-500 animate-pulse ml-1 align-bottom" />
                            </div>
                        </div>
                    )}

                    {/* Loading indicator when running but no stream yet */}
                    {isRunning && !currentStream && messages[messages.length - 1]?.role === 'user' && (
                        <div className="ai-message max-w-[90%]">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                                    <span className="text-sm text-surface-500">
                                        {runningTooLong ? '応答に時間がかかっています...' : '考え中...'}
                                    </span>
                                </div>
                                {runningTooLong && (
                                    <div className="flex items-center gap-2 text-xs text-surface-400">
                                        <span>処理がスタックしている可能性があります</span>
                                        <button
                                            onClick={() => {
                                                removeRunningThread(threadId);
                                                setStreamingContent(threadId, '');
                                                // Remove the optimistic message
                                                setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
                                            }}
                                            className="text-error-500 hover:text-error-600 underline"
                                        >
                                            キャンセル
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="absolute bottom-4 left-0 right-0 px-4 safe-bottom z-20">
                {showScrollToBottom && (
                    <button
                        onClick={() => scrollToBottom()}
                        className="absolute bottom-full right-4 mb-4 grid place-items-center w-10 h-10 bg-white dark:bg-surface-800 rounded-full shadow-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all animate-in fade-in zoom-in duration-200"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                )}

                {queueNotice && (
                    <div className="absolute bottom-full left-4 mb-2 z-10 text-xs text-surface-500 bg-white/90 dark:bg-surface-900/90 px-2 py-1 rounded-md shadow-sm border border-surface-200 dark:border-surface-700">
                        {queueNotice}
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        {isReady && isOwner && !hasApiKey && !isArchived && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[19px] bg-surface-50/60 dark:bg-surface-900/60 backdrop-blur-sm">
                                <button
                                    onClick={() => setApiKeyModalOpen(true)}
                                    className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg transition-all transform hover:scale-105"
                                >
                                    <KeyIcon className="w-3 h-3" />
                                    APIキーを登録して開始
                                </button>
                            </div>
                        )}
                        <textarea
                            ref={inputRef}
                            data-ai-thread-input="true"
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                // Mobile optimization (UI-004)
                                const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
                                if (isMobile) {
                                    setTimeout(() => {
                                        scrollToBottom('auto');
                                        // Scroll input area into view
                                        inputRef.current?.parentElement?.parentElement?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                    }, 400);
                                }
                            }}
                            placeholder={
                                isArchived
                                    ? 'アーカイブ済みのため送信できません'
                                    : !canIntervene
                                        ? '閲覧のみのため送信できません'
                                        : isOwner && !hasApiKey
                                            ? ''
                                            : isRunning
                                                ? 'AIが応答中...'
                                                : 'メッセージを入力...'
                            }
                            disabled={!isReady || isRunning || isArchived || !canIntervene || (isOwner && !hasApiKey)}
                            rows={1}
                            style={{ minHeight: '38px', height: '38px' }}
                            className="w-full resize-none rounded-[19px] border border-surface-200/50 dark:border-surface-700/50 bg-white dark:bg-surface-800 px-4 py-[9px] text-sm leading-5 max-h-32 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 placeholder:text-surface-400 transition-colors disabled:opacity-50"
                        />
                    </div>
                    {isRunning ? (
                        <button
                            onClick={() => {
                                removeRunningThread(threadId);
                                setStreamingContent(threadId, '');
                                setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
                            }}
                            className={cn(
                                "w-[38px] h-[38px] flex items-center justify-center rounded-full flex-shrink-0 transition-all shadow-lg mb-[1px]",
                                "bg-error-500 hover:bg-error-600 text-white"
                            )}
                            title="キャンセル"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="5" y="5" width="14" height="14" rx="2" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending || isArchived || !canIntervene || (isOwner && !hasApiKey)}
                            className={cn(
                                "w-[38px] h-[38px] flex items-center justify-center rounded-full flex-shrink-0 transition-all shadow-lg mb-[1px]",
                                "bg-primary-500 hover:bg-primary-600 text-white",
                                "disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:text-white/80 disabled:cursor-not-allowed"
                            )}
                        >
                            <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>


            {
                apiKeyModalOpen && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900">
                            {(() => {
                                const modalProvider = getProvider(thread?.model || 'gpt-5.2');
                                const modalLabel = modalProvider === 'google' ? 'Gemini API' : 'OpenAI API';
                                const modalUrl = modalProvider === 'google' ? 'https://aistudio.google.com/app/apikey' : 'https://platform.openai.com/api-keys';
                                const modalPlaceholder = modalProvider === 'google' ? 'AIza...' : 'sk-...';

                                return (
                                    <>
                                        <h3 className="text-lg font-semibold mb-2 text-surface-900 dark:text-surface-100">{modalLabel}キー登録</h3>
                                        <p className="text-sm text-surface-500 mb-4">
                                            AIスレッドを使うためにAPIキーを登録してください。<br />
                                            <a href={modalUrl} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                                                キーを取得する
                                            </a>
                                        </p>
                                        <input
                                            type="password"
                                            value={apiKeyInput}
                                            onChange={(e) => setApiKeyInput(e.target.value)}
                                            placeholder={modalPlaceholder}
                                            className="w-full text-sm py-2 px-4 rounded-full bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 placeholder:text-surface-400 transition-all outline-none shadow-sm text-surface-900 dark:text-surface-100"
                                        />
                                    </>
                                );
                            })()}
                            {apiKeyError && (
                                <div className="mt-2 text-sm text-error-600 dark:text-error-400">
                                    {apiKeyError}
                                </div>
                            )}
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setApiKeyModalOpen(false)}
                                    className="btn-secondary"
                                    disabled={apiKeySaving}
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSaveApiKey}
                                    className="btn-primary"
                                    disabled={apiKeySaving}
                                >
                                    {apiKeySaving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                membersOpen && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900 max-h-[80vh] overflow-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">メンバー管理</h3>
                                <button onClick={() => setMembersOpen(false)} className="btn-icon">
                                    ✕
                                </button>
                            </div>

                            {ownerProfile && (
                                <div className="mb-4 flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3 bg-surface-50/50 dark:bg-surface-800/50">
                                    <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700 ${ownerProfile.avatar_path ? 'bg-surface-200 dark:bg-surface-700' : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'}`}>
                                        {ownerProfile.avatar_path ? (
                                            <img
                                                src={getStorageUrl('avatars', ownerProfile.avatar_path)}
                                                alt={ownerProfile.display_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                                                {getInitials(ownerProfile.display_name)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{ownerProfile.display_name}</span>
                                            <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full dark:bg-primary-900/30 dark:text-primary-400">オーナー</span>
                                        </div>
                                        <div className="text-xs text-surface-500">@{ownerProfile.handle}</div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {members.map((member) => (
                                    <div key={member.user_id} className="flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                                        <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700 ${member.avatar_path ? 'bg-surface-200 dark:bg-surface-700' : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'}`}>
                                            {member.avatar_path ? (
                                                <img
                                                    src={getStorageUrl('avatars', member.avatar_path)}
                                                    alt={member.display_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                                                    {getInitials(member.display_name)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">{member.display_name}</p>
                                            <p className="text-xs text-surface-500">@{member.handle}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 pl-2">
                                            <select
                                                value={member.permission}
                                                onChange={(e) => handleUpdateMemberPermission(member.user_id, e.target.value as 'VIEW' | 'INTERVENE')}
                                                className="text-xs py-1 pl-2 pr-7 rounded-md border-surface-200 bg-surface-50 dark:bg-surface-800 dark:border-surface-700 focus:ring-1 focus:ring-primary-500"
                                            >
                                                <option value="VIEW">閲覧のみ</option>
                                                <option value="INTERVENE">閲覧・操作</option>
                                            </select>
                                            <button
                                                onClick={() => handleRemoveMember(member.user_id)}
                                                className="text-[10px] text-error-500 hover:text-error-600 hover:underline px-1"
                                            >
                                                削除する
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6">
                                <h4 className="text-sm font-semibold mb-2">メンバー追加</h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        placeholder="@handle で検索"
                                        className="flex-1 text-sm py-2 px-4 rounded-full bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 placeholder:text-surface-400 transition-all outline-none shadow-sm"
                                    />
                                    <button onClick={handleSearchMember} className="btn-secondary">
                                        検索
                                    </button>
                                </div>
                                {memberSearchResult && (
                                    <div className="mt-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3 flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700 ${memberSearchResult.avatar_path ? 'bg-surface-200 dark:bg-surface-700' : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'}`}>
                                            {memberSearchResult.avatar_path ? (
                                                <img
                                                    src={getStorageUrl('avatars', memberSearchResult.avatar_path)}
                                                    alt={memberSearchResult.display_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                                                    {getInitials(memberSearchResult.display_name)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">{memberSearchResult.display_name}</p>
                                            <p className="text-xs text-surface-500">@{memberSearchResult.handle}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <select
                                                value={memberPermission}
                                                onChange={(e) => setMemberPermission(e.target.value as 'VIEW' | 'INTERVENE')}
                                                className="text-xs py-1 pl-2 pr-7 rounded-md border-surface-200 bg-surface-50 dark:bg-surface-800 dark:border-surface-700 focus:ring-1 focus:ring-primary-500"
                                            >
                                                <option value="VIEW">閲覧のみ</option>
                                                <option value="INTERVENE">閲覧・操作</option>
                                            </select>
                                            <button onClick={handleAddMember} className="btn-primary text-xs px-3 py-1">
                                                追加
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {memberError && (
                                    <div className="mt-2 text-sm text-error-600 dark:text-error-400">
                                        {memberError}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                shareOpen && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900 max-h-[80vh] overflow-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">トークに共有</h3>
                                <button onClick={() => setShareOpen(false)} className="btn-icon">
                                    ✕
                                </button>
                            </div>
                            {shareLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {shareRooms.map((room) => (
                                        <button
                                            key={room.id}
                                            onClick={() => handleShareToRoom(room.id)}
                                            className="w-full flex items-center gap-3 text-left rounded-lg border border-surface-200 dark:border-surface-700 p-3 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                        >
                                    <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 relative ${room.avatar_path ? 'bg-surface-200 dark:bg-surface-700' : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'}`}>
                                        {room.avatar_path ? (
                                            <img
                                                src={getStorageUrl('avatars', room.avatar_path)}
                                                alt={room.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                                                {getInitials(room.name)}
                                            </div>
                                        )}
                                    </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{room.name}</p>
                                                <p className="text-xs text-surface-500">{room.type === 'dm' ? 'DM' : 'グループ'}</p>
                                            </div>
                                        </button>
                                    ))}
                                    {shareRooms.length === 0 && (
                                        <div className="text-center text-sm text-surface-500 py-6">
                                            共有できるトークがありません
                                        </div>
                                    )}
                                </div>
                            )}
                            {shareError && (
                                <div className="mt-3 text-sm text-error-600 dark:text-error-400">
                                    {shareError}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
