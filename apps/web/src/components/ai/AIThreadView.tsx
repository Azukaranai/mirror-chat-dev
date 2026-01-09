'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createSharedAIThreadCard, cn, getStorageUrl, getInitials } from '@/lib/utils';
import { useAIStore } from '@/lib/stores';
import type { AIThread } from '@/types/database';

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
    const [memberSearch, setMemberSearch] = useState('');
    const [memberSearchResult, setMemberSearchResult] = useState<{ user_id: string; display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [memberPermission, setMemberPermission] = useState<'VIEW' | 'INTERVENE'>('VIEW');
    const [memberError, setMemberError] = useState<string | null>(null);
    const [ownerProfile, setOwnerProfile] = useState<{ display_name: string; handle: string | null; avatar_path: string | null } | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareRooms, setShareRooms] = useState<Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }>>([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const [runningStartTime, setRunningStartTime] = useState<number | null>(null);
    const [runningTooLong, setRunningTooLong] = useState(false);

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

            return uniqueMessages.map((msg) => (
                <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : msg.role === 'system' ? 'flex justify-center' : ''}>
                    {msg.role === 'system' ? (
                        <div className="text-center py-2 px-4 text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 rounded-full">
                            {msg.content}
                        </div>
                    ) : msg.role === 'user' ? (
                        <div className="message-bubble-sent max-w-[80%]">
                            {msg.sender_kind === 'collaborator' && msg.sender_name && (
                                <p className="text-xs text-white/70 mb-1">{msg.sender_name}</p>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    ) : (
                        <div className="ai-message max-w-[90%]">
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    )}
                </div>
            ));
        },
        [messages]
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

    const kickQueue = useCallback(async () => {
        const now = Date.now();
        if (now - queueKickRef.current < 1500) return;
        queueKickRef.current = now;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            await supabase.functions.invoke('ai_process_queue', {
                body: { threadId },
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });
        } catch (error) {
            console.error('Failed to process queue:', error);
        }
    }, [supabase, threadId]);

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

        const mapped = (memberRows || [])
            .map((row: any) => {
                const profile = profilesById[row.user_id];
                if (!profile) return null;
                return {
                    user_id: row.user_id,
                    display_name: profile.display_name,
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
            // This ownerProfile is for the members list, not the header.
            // setOwnerProfile((owner as any) || null);
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
                setIsOwner(data.owner_user_id === userId);
            } else if (error) {
                console.error('Error loading thread:', error);
                // Try fallback to member check if direct access failed (e.g. shared thread)
                const { data: membership } = await supabase
                    .from('ai_thread_members')
                    .select('ai_threads!inner(*)')
                    .eq('thread_id', threadId)
                    .eq('user_id', userId)
                    .single();

                if (membership && membership.ai_threads) {
                    const joined = Array.isArray(membership.ai_threads)
                        ? membership.ai_threads[0]
                        : membership.ai_threads;
                    setThread(joined as AIThread);
                }
            }
            setThreadLoading(false);
        };

        if (threadId && !thread) {
            loadThread();
        } else if (thread) {
            setThreadLoading(false);
        }
    }, [threadId, thread, supabase, userId]);

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

                const formattedMessages = msgs.map((msg: any) => ({
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
        if (isOwner && membersOpen) {
            fetchMembers();
        }
    }, [membersOpen, fetchMembers, isOwner]);

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
                    created_at: new Date().toISOString(),
                },
            ]);

            setStreamingContent(threadId, '');
            addRunningThread(threadId);

            // Get auth token
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('ai_send_message', {
                body: {
                    threadId,
                    content,
                    kind: isOwner ? 'owner' : 'collaborator',
                },
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });

            if (error) {
                console.error('Failed to send message:', error);
                if (error.message?.toLowerCase().includes('api key')) {
                    handleOpenApiKeyModal();
                }
                removeRunningThread(threadId);
                // Remove optimistic message
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
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

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

        try {
            // Get auth token
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            const { data, error } = await supabase.functions.invoke('key_set', {
                body: { apiKey: apiKeyInput.trim(), provider },
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });

            if (error) {
                console.error('Failed to save API key:', error);
                const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
                setApiKeyError(`保存に失敗しました: ${errorMsg}`);
                return;
            }

            setApiKeys(prev => ({ ...prev, [provider]: data?.last4 }));
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
        } catch (e) {
            console.error('Failed to fetch rooms:', e);
            setShareError('ルーム一覧の取得に失敗しました');
        } finally {
            setShareLoading(false);
        }
    }, [supabase, userId]);

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

    const MODEL_OPTIONS = [
        { id: 'gpt-5.2', label: 'OpenAI (GPT-5.2)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ];



    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
                {!isEmbedded && (
                    <Link href="/ai" className="md:hidden btn-icon">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
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

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-surface-500 mt-1.5 leading-none">
                        {isOwner ? (
                            <div className="relative flex items-center">
                                <select
                                    value={thread?.model || 'gpt-5.2'}
                                    onChange={(e) => handleUpdateModel(e.target.value)}
                                    className="appearance-none bg-transparent border-none p-0 pr-3.5 text-xs text-surface-900 dark:text-surface-200 font-medium focus:ring-0 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                >
                                    {MODEL_OPTIONS.map((option) => {
                                        const isRegistered = Boolean(apiKeys[getProvider(option.id)]);
                                        return (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                                {isRegistered ? ' (✅登録済み)' : ''}
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
                            <span className="font-medium text-surface-900 dark:text-surface-200">
                                {MODEL_OPTIONS.find((o) => o.id === thread?.model)?.label ||
                                    (thread?.model?.startsWith('gemini') ? 'Gemini API' : 'OpenAI API')}
                            </span>
                        )}

                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full border",
                            hasApiKey
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                : !isOwner
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800"
                                    : "bg-surface-100 text-surface-500 border-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:border-surface-700"
                        )}>
                            {hasApiKey
                                ? '✅ あなたのAPI'
                                : !isOwner
                                    ? `👤 ${ownerProfile?.display_name ? ownerProfile.display_name + 'の設定に依存' : 'オーナー設定に依存'}`
                                    : '⚠️ API未登録'}
                        </span>

                        {thread?.created_at && (
                            <>
                                <span className="text-surface-300 dark:text-surface-600">•</span>
                                <span className="whitespace-nowrap font-mono opacity-80">
                                    {new Date(thread.created_at).toLocaleDateString('ja-JP')}
                                </span>
                            </>
                        )}

                        {ownerProfile && (
                            <>
                                <span className="text-surface-300 dark:text-surface-600">•</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {ownerProfile.avatar_path ? (
                                        <div className="w-4 h-4 rounded-full overflow-hidden ring-1 ring-surface-200 dark:ring-surface-700 relative">
                                            <img
                                                src={getStorageUrl('avatars', ownerProfile.avatar_path)}
                                                alt={ownerProfile.display_name || ownerProfile.handle || 'Unknown'}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-4 h-4 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-[7px] font-bold text-surface-600 dark:text-surface-300 uppercase ring-1 ring-surface-300/50">
                                            {getInitials(ownerProfile.display_name || ownerProfile.handle || 'Unknown')}
                                        </div>
                                    )}
                                    <span className="truncate max-w-[100px] hover:text-surface-800 dark:hover:text-surface-200 transition-colors">
                                        {ownerProfile.display_name || ownerProfile.handle || 'Unknown'}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="relative">
                    <button
                        ref={menuButtonRef}
                        onClick={() => {
                            if (!headerMenuOpen && menuButtonRef.current) {
                                const rect = menuButtonRef.current.getBoundingClientRect();
                                setMenuStyle({
                                    position: 'fixed',
                                    top: `${rect.bottom + 8}px`,
                                    right: `${window.innerWidth - rect.right}px`,
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
                                className="absolute w-56 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100 py-1"
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
            <div className="flex-1 relative min-h-0">
                {!isReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface-900 z-10">
                        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-auto px-4 pt-4 pb-24 space-y-4"
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
                            <p className="text-sm whitespace-pre-wrap">{currentStream}</p>
                            <span className="inline-block w-2 h-4 bg-accent-500 animate-pulse ml-1" />
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
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
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
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
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
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900 max-h-[80vh] overflow-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">メンバー管理</h3>
                                <button onClick={() => setMembersOpen(false)} className="btn-icon">
                                    ✕
                                </button>
                            </div>

                            {ownerProfile && (
                                <div className="mb-4 flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3 bg-surface-50/50 dark:bg-surface-800/50">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700 flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700">
                                        {ownerProfile.avatar_path ? (
                                            <img
                                                src={getStorageUrl('avatars', ownerProfile.avatar_path)}
                                                alt={ownerProfile.display_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-surface-500">
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
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700 flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700">
                                            {member.avatar_path ? (
                                                <img
                                                    src={getStorageUrl('avatars', member.avatar_path)}
                                                    alt={member.display_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-surface-500">
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
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700 flex-shrink-0 relative ring-1 ring-surface-200 dark:ring-surface-700">
                                            {memberSearchResult.avatar_path ? (
                                                <img
                                                    src={getStorageUrl('avatars', memberSearchResult.avatar_path)}
                                                    alt={memberSearchResult.display_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-surface-500">
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
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
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
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700 flex-shrink-0 relative">
                                                {room.avatar_path ? (
                                                    <img
                                                        src={getStorageUrl('avatars', room.avatar_path)}
                                                        alt={room.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-surface-500">
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
