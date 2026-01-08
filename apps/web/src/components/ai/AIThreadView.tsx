'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
}

export function AIThreadView({ threadId, userId, isOwner, thread: initialThread }: AIThreadViewProps) {
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Use store with updated definition
    const streamingContent = useAIStore(state => state.streamingContent);
    const setStreamingContent = useAIStore(state => state.setStreamingContent);
    const runningThreads = useAIStore(state => state.runningThreads);
    const addRunningThread = useAIStore(state => state.addRunningThread);
    const removeRunningThread = useAIStore(state => state.removeRunningThread);

    const isRunning = runningThreads.has(threadId);
    const currentStream = streamingContent.get(threadId);
    const isArchived = Boolean(thread?.archived_at);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

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

    // Scroll on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, currentStream, scrollToBottom]);

    // Send message
    const handleSend = async () => {
        if (!input.trim() || sending || isRunning || isArchived) return;

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
            const { error } = await supabase.functions.invoke('ai_send_message', {
                body: {
                    threadId,
                    content,
                    kind: isOwner ? 'owner' : 'collaborator',
                },
            });

            if (error) {
                console.error('Failed to send message:', error);
                removeRunningThread(threadId);
                // Remove optimistic message
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                setInput(content);
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
                    <p className="text-xs text-surface-500">{thread?.model || 'gpt-4o'}</p>
                </div>
                <div className="flex items-center gap-1">
                    {isOwner && (
                        <button onClick={handleShare} className="btn-icon" title="共有">
                            <ShareIcon className="w-5 h-5" />
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

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {isArchived && (
                    <div className="text-center py-2 text-sm text-surface-500">
                        このスレッドはアーカイブされています。
                    </div>
                )}
                {messages.length === 0 && !currentStream && (
                    <div className="text-center py-8 text-surface-400">
                        <p>メッセージがありません</p>
                        <p className="text-sm mt-1">AIに質問してみましょう</p>
                    </div>
                )}

                {messages.map((msg) => (
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
                ))}

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
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isArchived ? 'アーカイブ済みのため送信できません' : isRunning ? 'AIが応答中...' : 'メッセージを入力...'}
                            disabled={isRunning || isArchived}
                            rows={1}
                            className="input resize-none py-2.5 min-h-[42px] max-h-32 disabled:opacity-50"
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending || isRunning || isArchived}
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
        </div>
    );
}
