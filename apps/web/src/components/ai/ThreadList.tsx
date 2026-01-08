'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

interface Thread {
    id: string;
    title: string;
    model: string;
    updated_at: string;
    is_shared: boolean;
}

interface ThreadListProps {
    userId: string;
    activeThreadId?: string;
}

export function ThreadList({ userId, activeThreadId }: ThreadListProps) {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [sharedThreads, setSharedThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);

    // Fetch threads
    useEffect(() => {
        const fetchThreads = async () => {
            setLoading(true);

            // Get owned threads
            const { data: owned } = await supabase
                .from('ai_threads')
                .select('id, title, model, updated_at')
                .eq('owner_user_id', userId)
                .is('archived_at', null)
                .order('updated_at', { ascending: false });

            if (owned) {
                setThreads((owned as any[]).map((t) => ({
                    id: t.id,
                    title: t.title,
                    model: t.model,
                    updated_at: t.updated_at,
                    is_shared: false
                })));
            }

            // Get shared threads
            const { data: shared } = await supabase
                .from('ai_thread_members')
                .select(`
          thread_id,
          ai_threads!inner(id, title, model, updated_at, archived_at)
        `)
                .eq('user_id', userId);

            if (shared) {
                const sharedList = (shared as any[])
                    .filter((s: any) => s.ai_threads && s.ai_threads.archived_at === null)
                    .map((s: any) => {
                        const thread = Array.isArray(s.ai_threads) ? s.ai_threads[0] : s.ai_threads;
                        return {
                            id: thread.id,
                            title: thread.title,
                            model: thread.model,
                            updated_at: thread.updated_at,
                            is_shared: true,
                        };
                    });
                setSharedThreads(sharedList);
            }

            setLoading(false);
        };

        fetchThreads();
    }, [supabase, userId]);

    // Create new thread
    const handleNewThread = async () => {
        setCreating(true);

        const { data: newThread, error } = await supabase
            .from('ai_threads')
            .insert({
                owner_user_id: userId,
                title: '新規スレッド',
                model: 'gpt-4o',
            } as any)
            .select()
            .single();

        if (!error && newThread) {
            router.push(`/ai/${(newThread as any).id}`);
        }

        setCreating(false);
    };

    const allThreads = [...threads, ...sharedThreads].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const filteredThreads = allThreads.filter((thread) =>
        thread.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto flex flex-col">
            {/* New Thread Button */}
            <div className="p-3">
                <button
                    onClick={handleNewThread}
                    disabled={creating}
                    className="btn-primary w-full justify-center bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600"
                >
                    {creating ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <PlusIcon className="w-5 h-5" />
                            新規スレッド
                        </>
                    )}
                </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-3">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="スレッドを検索..."
                    className="input text-sm py-2"
                />
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-auto px-2">
                {filteredThreads.length > 0 ? (
                    filteredThreads.map((thread) => (
                        <Link
                            key={thread.id}
                            href={`/ai/${thread.id}`}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors',
                                activeThreadId === thread.id && 'bg-surface-100 dark:bg-surface-800'
                            )}
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{thread.title}</p>
                                    {thread.is_shared && (
                                        <span className="px-1.5 py-0.5 text-xs bg-accent-500/20 text-accent-600 dark:text-accent-400 rounded">
                                            共有
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-surface-500">
                                    {thread.model} • {formatRelativeTime(thread.updated_at)}
                                </p>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="text-center py-12 text-surface-400">
                        <p>スレッドがありません</p>
                        <p className="text-sm mt-1">新規スレッドを作成してAIと会話しましょう</p>
                    </div>
                )}
            </div>
        </div>
    );
}
