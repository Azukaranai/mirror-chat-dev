'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createSharedAIThreadCard } from '@/lib/utils';
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
    isOwner,
    thread: initialThread,
    permission = null,
    variant = 'page',
}: AIThreadViewProps) {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [thread, setThread] = useState(initialThread);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingTitle, setEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState(thread?.title || '');
    const [actionStatus, setActionStatus] = useState<'archive' | 'delete' | null>(null);
    const [currentPermission, setCurrentPermission] = useState<'VIEW' | 'INTERVENE' | null>(permission);
    const [queueNotice, setQueueNotice] = useState<string | null>(null);
    const [apiKeyLast4, setApiKeyLast4] = useState<string | null>(null);
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeySaving, setApiKeySaving] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Array<{ user_id: string; display_name: string; handle: string; avatar_path: string | null; permission: 'VIEW' | 'INTERVENE' }>>([]);
    const [ownerProfile, setOwnerProfile] = useState<{ display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberSearchResult, setMemberSearchResult] = useState<{ user_id: string; display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [memberPermission, setMemberPermission] = useState<'VIEW' | 'INTERVENE'>('VIEW');
    const [memberError, setMemberError] = useState<string | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareRooms, setShareRooms] = useState<Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }>>([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const queueKickRef = useRef(0);

    // Use store with updated definition
    const streamingContent = useAIStore(state => state.streamingContent);
    const setStreamingContent = useAIStore(state => state.setStreamingContent);
    const runningThreads = useAIStore(state => state.runningThreads);
    const addRunningThread = useAIStore(state => state.addRunningThread);
    const removeRunningThread = useAIStore(state => state.removeRunningThread);

    const isRunning = runningThreads.has(threadId);
    const currentStream = streamingContent.get(threadId);
    const isArchived = Boolean(thread?.archived_at);
    const isEmbedded = variant === 'embedded';
    const canIntervene = isOwner || currentPermission === 'INTERVENE';
    const hasApiKey = Boolean(apiKeyLast4);
    const renderedMessages = useMemo(
        () =>
            messages.map((msg) => (
                <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                    {msg.role === 'user' ? (
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
            )),
        [messages]
    );

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const kickQueue = useCallback(async () => {
        const now = Date.now();
        if (now - queueKickRef.current < 1500) return;
        queueKickRef.current = now;
        try {
            await supabase.functions.invoke('ai_process_queue', {
                body: { threadId },
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

            profilesById = (profiles || []).reduce((acc, profile) => {
                acc[profile.user_id] = profile as any;
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
            setOwnerProfile((owner as any) || null);
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
        if (!isOwner) return;
        let canceled = false;

        const loadApiKey = async () => {
            const { data } = await supabase
                .from('user_llm_keys')
                .select('key_last4')
                .eq('user_id', userId)
                .maybeSingle();

            if (!canceled) {
                setApiKeyLast4((data as any)?.key_last4 || null);
            }
        };

        loadApiKey();

        return () => {
            canceled = true;
        };
    }, [supabase, userId, isOwner]);

    // Fetch messages
    useEffect(() => {
        const fetchMessages = async () => {
            setLoading(true);

            const { data: msgs } = await supabase
                .from('ai_messages')
                .select(`
          id,
          role,
          content,
          sender_kind,
          sender_user_id,
          created_at,
          profiles:sender_user_id(display_name)
        `)
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (msgs) {
                setMessages(
                    msgs.map((m: any) => {
                        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                        return {
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            sender_kind: m.sender_kind,
                            sender_name: profile?.display_name,
                            created_at: m.created_at,
                        };
                    })
                );
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

            setLoading(false);
        };

        fetchMessages();

        // Subscribe to new messages
        const messagesChannel = supabase
            .channel(`ai_messages:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ai_messages',
                    filter: `thread_id=eq.${threadId}`,
                },
                async (payload) => {
                    const newMsg = payload.new as any;

                    // Get sender name if user
                    let senderName: string | undefined;
                    if (newMsg.sender_user_id) {
                        const { data: sender } = await supabase
                            .from('profiles')
                            .select('display_name')
                            .eq('user_id', newMsg.sender_user_id)
                            .single();
                        senderName = (sender as any)?.display_name;
                    }

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: newMsg.id,
                            role: newMsg.role,
                            content: newMsg.content,
                            sender_kind: newMsg.sender_kind,
                            sender_name: senderName,
                            created_at: newMsg.created_at,
                        },
                    ]);

                    // Clear streaming content when assistant message arrives
                    if (newMsg.role === 'assistant') {
                        setStreamingContent(threadId, '');
                        removeRunningThread(threadId);
                        kickQueue();
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
    }, [supabase, threadId, addRunningThread, removeRunningThread, setStreamingContent, kickQueue]);

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
        scrollToBottom();
    }, [messages, currentStream, scrollToBottom]);

    useEffect(() => {
        if (isOwner && membersOpen) {
            fetchMembers();
        }
    }, [membersOpen, fetchMembers, isOwner]);

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

            addRunningThread(threadId);

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('ai_send_message', {
                body: {
                    threadId,
                    content,
                    kind: isOwner ? 'owner' : 'collaborator',
                },
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
        const { data, error } = await supabase.functions.invoke('ai_duplicate_thread', {
            body: { threadId },
        });

        if (error || !data?.newThreadId) {
            alert('複製に失敗しました');
            return;
        }

        router.push(`/ai/${data.newThreadId}`);
        router.refresh();
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

        try {
            const { data, error } = await supabase.functions.invoke('key_set', {
                body: { apiKey: apiKeyInput.trim() },
            });

            if (error) {
                setApiKeyError('APIキーの保存に失敗しました');
                return;
            }

            setApiKeyLast4(data?.last4 || null);
            setApiKeyModalOpen(false);
            setApiKeyInput('');
        } catch {
            setApiKeyError('APIキーの保存に失敗しました');
        } finally {
            setApiKeySaving(false);
        }
    };

    const fetchShareRooms = useCallback(async () => {
        setShareLoading(true);
        setShareError(null);

        const { data: memberOf } = await supabase
            .from('room_members')
            .select('room_id, rooms!inner(id, type, group_id)')
            .eq('user_id', userId);

        if (!memberOf) {
            setShareRooms([]);
            setShareLoading(false);
            return;
        }

        const roomList: Array<{ id: string; name: string; avatar_path: string | null; type: 'dm' | 'group' }> = [];

        for (const m of memberOf as any[]) {
            const room = Array.isArray(m.rooms) ? m.rooms[0] : m.rooms;
            let name = '';
            let avatarPath: string | null = null;

            if (room.type === 'dm') {
                const { data: otherMember } = await supabase
                    .from('room_members')
                    .select('user_id, profiles!inner(display_name, avatar_path)')
                    .eq('room_id', room.id)
                    .neq('user_id', userId)
                    .single();

                if (otherMember) {
                    const profile = (otherMember as any).profiles;
                    name = Array.isArray(profile) ? profile[0].display_name : profile.display_name;
                    avatarPath = Array.isArray(profile) ? profile[0].avatar_path : profile.avatar_path;
                }
            } else if (room.group_id) {
                const { data: group } = await supabase
                    .from('groups')
                    .select('name, avatar_path')
                    .eq('id', room.group_id)
                    .single();

                if (group) {
                    name = (group as any).name;
                    avatarPath = (group as any).avatar_path;
                }
            }

            roomList.push({
                id: room.id,
                name: name || 'トーク',
                avatar_path: avatarPath,
                type: room.type,
            });
        }

        setShareRooms(roomList);
        setShareLoading(false);
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

        if (isOwner) {
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

        if (thread?.owner_user_id === profile.user_id) {
            setMemberError('オーナーは既に参加しています');
            return;
        }

        if (members.some((m) => m.user_id === profile.user_id)) {
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

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            {!isEmbedded && (
                <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
                    <Link href="/ai" className="md:hidden btn-icon">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        {editingTitle ? (
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onBlur={handleUpdateTitle}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                                className="input py-1 text-lg font-semibold"
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
                            <span>{thread?.model || 'gpt-4o'}</span>
                            {isOwner && (
                                <span>
                                    {hasApiKey ? `APIキー登録済み (...${apiKeyLast4})` : 'APIキー未登録'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleDuplicate} className="btn-icon" title="複製">
                            <DuplicateIcon className="w-5 h-5" />
                        </button>
                        {isOwner && (
                            <button
                                onClick={() => {
                                    setShareOpen(true);
                                    fetchShareRooms();
                                }}
                                className="btn-icon"
                                title="トークに共有"
                            >
                                <ShareToChatIcon className="w-5 h-5" />
                            </button>
                        )}
                        {isOwner && (
                            <button onClick={handleShare} className="btn-icon" title="リンク共有">
                                <ShareIcon className="w-5 h-5" />
                            </button>
                        )}
                        {isOwner && (
                            <button onClick={() => setMembersOpen(true)} className="btn-icon" title="メンバー管理">
                                <UsersIcon className="w-5 h-5" />
                            </button>
                        )}
                        {isOwner && (
                            <button onClick={handleOpenApiKeyModal} className="btn-icon" title="APIキー">
                                <KeyIcon className="w-5 h-5" />
                            </button>
                        )}
                        {isOwner && !isArchived && (
                            <button
                                onClick={handleArchive}
                                className="btn-icon"
                                title="アーカイブ"
                                disabled={actionStatus === 'archive'}
                            >
                                <ArchiveIcon className="w-5 h-5" />
                            </button>
                        )}
                        {isOwner && (
                            <button
                                onClick={handleDelete}
                                className="btn-icon text-error-500"
                                title="削除"
                                disabled={actionStatus === 'delete'}
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
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
                {messages.length === 0 && !currentStream && (
                    <div className="text-center py-8 text-surface-400">
                        <p>メッセージがありません</p>
                        <p className="text-sm mt-1">AIに質問してみましょう</p>
                    </div>
                )}

                {renderedMessages}

                {/* Streaming response */}
                {currentStream && (
                    <div className="ai-message max-w-[90%]">
                        <p className="text-sm whitespace-pre-wrap">{currentStream}</p>
                        <span className="inline-block w-2 h-4 bg-accent-500 animate-pulse ml-1" />
                    </div>
                )}

                {/* Loading indicator when running but no stream yet */}
                {isRunning && !currentStream && messages[messages.length - 1]?.role === 'user' && (
                    <div className="ai-message max-w-[90%]">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                            <span className="text-sm text-surface-500">考え中...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-surface-200 dark:border-surface-800 p-3 bg-white dark:bg-surface-900 safe-bottom">
                {queueNotice && (
                    <div className="mb-2 text-xs text-surface-500">{queueNotice}</div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isArchived
                                    ? 'アーカイブ済みのため送信できません'
                                    : !canIntervene
                                        ? '閲覧のみのため送信できません'
                                        : isOwner && !hasApiKey
                                            ? 'APIキーを登録してください'
                                            : isRunning
                                                ? 'AIが応答中...'
                                                : 'メッセージを入力...'
                            }
                            disabled={isRunning || isArchived || !canIntervene || (isOwner && !hasApiKey)}
                            rows={1}
                            className="input resize-none py-2.5 min-h-[42px] max-h-32 disabled:opacity-50"
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending || isRunning || isArchived || !canIntervene || (isOwner && !hasApiKey)}
                        className="btn-primary p-2.5 rounded-full flex-shrink-0 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Footer note */}
                <p className="text-xs text-center text-surface-400 mt-2">
                    AIは間違いを犯す可能性があります。重要な情報は確認してください。
                </p>
            </div>

            {apiKeyModalOpen && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900">
                        <h3 className="text-lg font-semibold mb-2">OpenAI APIキー登録</h3>
                        <p className="text-sm text-surface-500 mb-4">
                            AIスレッドを使うためにAPIキーを登録してください。
                        </p>
                        <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="sk-..."
                            className="input w-full"
                        />
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
            )}

            {membersOpen && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-900 max-h-[80vh] overflow-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">メンバー管理</h3>
                            <button onClick={() => setMembersOpen(false)} className="btn-icon">
                                ✕
                            </button>
                        </div>

                        {ownerProfile && (
                            <div className="mb-4 rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm">
                                <div className="font-medium">オーナー</div>
                                <div className="text-surface-500">@{ownerProfile.handle}</div>
                                <div className="text-surface-400">{ownerProfile.display_name}</div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {members.map((member) => (
                                <div key={member.user_id} className="flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{member.display_name}</p>
                                        <p className="text-xs text-surface-500">@{member.handle}</p>
                                    </div>
                                    <select
                                        value={member.permission}
                                        onChange={(e) => handleUpdateMemberPermission(member.user_id, e.target.value as 'VIEW' | 'INTERVENE')}
                                        className="input text-xs py-1"
                                    >
                                        <option value="VIEW">VIEW</option>
                                        <option value="INTERVENE">INTERVENE</option>
                                    </select>
                                    <button
                                        onClick={() => handleRemoveMember(member.user_id)}
                                        className="btn-ghost text-xs px-2 py-1 text-error-500"
                                    >
                                        削除
                                    </button>
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
                                    className="input flex-1"
                                />
                                <button onClick={handleSearchMember} className="btn-secondary">
                                    検索
                                </button>
                            </div>
                            {memberSearchResult && (
                                <div className="mt-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{memberSearchResult.display_name}</p>
                                        <p className="text-xs text-surface-500">@{memberSearchResult.handle}</p>
                                    </div>
                                    <select
                                        value={memberPermission}
                                        onChange={(e) => setMemberPermission(e.target.value as 'VIEW' | 'INTERVENE')}
                                        className="input text-xs py-1"
                                    >
                                        <option value="VIEW">VIEW</option>
                                        <option value="INTERVENE">INTERVENE</option>
                                    </select>
                                    <button onClick={handleAddMember} className="btn-primary text-xs px-2 py-1">
                                        追加
                                    </button>
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
            )}

            {shareOpen && (
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
                                        className="w-full text-left rounded-lg border border-surface-200 dark:border-surface-700 p-3 hover:bg-surface-100 dark:hover:bg-surface-800"
                                    >
                                        <p className="font-medium truncate">{room.name}</p>
                                        <p className="text-xs text-surface-500">{room.type === 'dm' ? 'DM' : 'グループ'}</p>
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
            )}
        </div>
    );
}
