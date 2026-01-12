'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeTime, getInitials, getStorageUrl, cn } from '@/lib/utils';

// ... (icons)

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const EllipsisHorizontalIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12a.75.75 0 110-1.5.75.75 0 010 1.5zM17.25 12a.75.75 0 110-1.5.75.75 0 010 1.5z" />
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

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-10.5 0V6a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0113.5 6v1.5m-7.5 0l.75 12A1.5 1.5 0 008.25 21h7.5a1.5 1.5 0 001.5-1.5l.75-12" />
    </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.75a3.75 3.75 0 00-7.5 0m7.5 0v.75a1.5 1.5 0 01-1.5 1.5h-4.5a1.5 1.5 0 01-1.5-1.5v-.75m7.5 0a3.75 3.75 0 00-7.5 0M15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 1.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
);

interface Thread {
    id: string;
    title: string;
    model: string;
    updated_at: string;
    is_shared: boolean;
    is_owner: boolean;
    shared_owner_avatar?: string | null;
    shared_owner_name?: string | null;
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
    const [createError, setCreateError] = useState<string | null>(null);
    const [menuOpenThreadId, setMenuOpenThreadId] = useState<string | null>(null);
    const [busyThreadId, setBusyThreadId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; visibility?: 'hidden' | 'visible' }>({
        top: 0,
        left: 0,
        visibility: 'hidden'
    });
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const menuContainerRef = useRef<HTMLDivElement | null>(null);
    const menuAnchorRef = useRef<DOMRect | null>(null);

    // Fetch threads
    const fetchThreads = useCallback(async () => { // useCallbackに変更
        // setLoading(true); // Subscriptionからの呼び出しでちらつかないようにローディングは初回のみ

        // Get owned threads
        const { data: owned } = await supabase
            .from('ai_threads')
            .select('id, title, model, updated_at')
            .eq('owner_user_id', userId)
            .is('archived_at', null)
            .order('updated_at', { ascending: false });

        const ownedIds = new Set((owned || []).map((t: any) => t.id));

        // Get shared threads
        const { data: shared } = await supabase
            .from('ai_thread_members')
            .select(`
      thread_id,
      ai_threads!inner(id, title, model, updated_at, archived_at, owner_user_id)
    `)
            .eq('user_id', userId);

        let sharedIds = new Set<string>();
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
                        owner_user_id: thread.owner_user_id,
                        is_shared: true,
                        is_owner: false,
                    };
                })
                .filter((thread) => thread.id);
            sharedIds = new Set(sharedList.map((thread) => thread.id));
            const sharedOwnerIds = Array.from(
                new Set(sharedList.map((thread) => thread.owner_user_id).filter(Boolean))
            );
            let ownersById = new Map<string, { avatar_path: string | null; display_name: string | null; handle: string | null }>();
            if (sharedOwnerIds.length > 0) {
                const { data: ownerProfiles } = await supabase
                    .from('profiles')
                    .select('user_id, display_name, handle, avatar_path')
                    .in('user_id', sharedOwnerIds);

                (ownerProfiles || []).forEach((profile: any) => {
                    ownersById.set(profile.user_id, {
                        avatar_path: profile.avatar_path,
                        display_name: profile.display_name,
                        handle: profile.handle,
                    });
                });
            }

            setSharedThreads(
                sharedList
                    .filter((thread) => !ownedIds.has(thread.id))
                    .map((thread) => {
                        const owner = thread.owner_user_id ? ownersById.get(thread.owner_user_id) : null;
                        return {
                            id: thread.id,
                            title: thread.title,
                            model: thread.model,
                            updated_at: thread.updated_at,
                            is_shared: true,
                            is_owner: false,
                            shared_owner_avatar: owner?.avatar_path || null,
                            shared_owner_name: owner?.display_name || owner?.handle || null,
                        } as Thread;
                    })
            );
        } else {
            setSharedThreads([]);
        }

        if (owned) {
            setThreads((owned as any[]).map((t) => ({
                id: t.id,
                title: t.title,
                model: t.model,
                updated_at: t.updated_at,
                is_shared: sharedIds.has(t.id),
                is_owner: true,
            })));
        } else {
            setThreads([]);
        }

        setLoading(false);
    }, [supabase, userId]);

    // Initial fetch
    useEffect(() => {
        setLoading(true);
        fetchThreads();
    }, [fetchThreads]);

    useEffect(() => {
        if (!menuOpenThreadId) return;
        const handleOutsideClick = (event: MouseEvent) => {
            if (
                menuContainerRef.current?.contains(event.target as Node) ||
                menuButtonRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setMenuOpenThreadId(null);
        };

        window.addEventListener('mousedown', handleOutsideClick);
        return () => {
            window.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [menuOpenThreadId]);

    useEffect(() => {
        if (!menuOpenThreadId || !menuContainerRef.current || !menuAnchorRef.current) return;
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

            setMenuPosition({ top, left, visibility: 'visible' });
        });

        return () => cancelAnimationFrame(frame);
    }, [menuOpenThreadId]);

    useEffect(() => {
        if (!menuOpenThreadId) return;
        const ownedExists = threads.some((thread) => thread.id === menuOpenThreadId);
        const sharedExists = sharedThreads.some((thread) => thread.id === menuOpenThreadId);
        if (!ownedExists && !sharedExists) {
            setMenuOpenThreadId(null);
        }
    }, [threads, sharedThreads, menuOpenThreadId]);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('ai_thread_list_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_threads',
                },
                () => {
                    fetchThreads();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_thread_members',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    fetchThreads();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchThreads, userId]);

    // Create new thread
    const handleNewThread = async () => {
        setCreating(true);
        setCreateError(null);

        // Determine initial model based on available keys
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
        } catch (e) {
            // Ignore error, use default
        }

        const { data: newThread, error } = await supabase
            .from('ai_threads')
            .insert({
                owner_user_id: userId,
                title: '新規スレッド',
                model: initialModel,
            } as any)
            .select()
            .single();

        if (!error && newThread) {
            router.push(`/ai/${(newThread as any).id}`);
        } else if (error) {
            console.error('Failed to create thread:', error);
            setCreateError(error.message || 'スレッドの作成に失敗しました');
        } else {
            setCreateError('スレッドの作成に失敗しました');
        }

        setCreating(false);
    };

    const handleRenameThread = async (thread: Thread) => {
        const defaultTitle = thread.title || '新規スレッド';
        const newTitle = window.prompt('スレッド名を入力してください', defaultTitle);
        if (!newTitle) {
            setMenuOpenThreadId(null);
            return;
        }
        const trimmed = newTitle.trim();
        if (trimmed === '' || trimmed === thread.title) {
            setMenuOpenThreadId(null);
            return;
        }

        setBusyThreadId(thread.id);
        try {
            const { error } = await supabase
                .from('ai_threads')
                .update({ title: trimmed } as any)
                .eq('id', thread.id);

            if (error) {
                console.error('Thread rename failed:', error);
                alert('スレッド名の更新に失敗しました');
            } else {
                await fetchThreads();
            }
        } finally {
            setBusyThreadId(null);
            setMenuOpenThreadId(null);
        }
    };

    const handleCopyThreadLink = async (threadId: string) => {
        const shareUrl = `${window.location.origin}/ai/${threadId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            alert('共有リンクをコピーしました');
        } catch (e) {
            console.error('share link copy failed', e);
            alert('共有リンクのコピーに失敗しました');
        } finally {
            setMenuOpenThreadId(null);
        }
    };

    const handleDeleteThread = async (threadId: string) => {
        if (!confirm('このスレッドを削除しますか？この操作は取り消せません。')) {
            setMenuOpenThreadId(null);
            return;
        }

        setBusyThreadId(threadId);
        try {
            const { error } = await supabase
                .from('ai_threads')
                .delete()
                .eq('id', threadId);

            if (error) {
                console.error('Thread delete failed:', error);
                alert('スレッドの削除に失敗しました');
            } else {
                await fetchThreads();
            }
        } finally {
            setBusyThreadId(null);
            setMenuOpenThreadId(null);
        }
    };

    const handleLeaveSharedThread = async (threadId: string) => {
        if (!confirm('この共有スレッドを一覧から非表示にしますか？')) {
            setMenuOpenThreadId(null);
            return;
        }

        setBusyThreadId(threadId);
        try {
            const { error } = await supabase
                .from('ai_thread_members')
                .delete()
                .eq('thread_id', threadId)
                .eq('user_id', userId);

            if (error) {
                console.error('Failed to leave shared thread:', error);
                alert('スレッドを非表示にできませんでした');
            } else {
                await fetchThreads();
            }
        } finally {
            setBusyThreadId(null);
            setMenuOpenThreadId(null);
        }
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
        <div className="flex-1 overflow-auto flex flex-col relative">
            {/* New Thread Button - Desktop only */}
            <div className="p-3 hidden md:block">
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
                {createError && (
                    <div className="mt-2 text-xs text-error-600 dark:text-error-400">
                        {createError}
                    </div>
                )}
            </div>

            {/* Search */}
            <div className="px-3 pb-3 pt-3 md:pt-0">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="スレッドを検索..."
                    className="w-full text-sm py-2 px-4 rounded-full bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 placeholder:text-surface-400 transition-all outline-none shadow-sm"
                />
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-auto px-2 pb-24 md:pb-2">
                {filteredThreads.length > 0 ? (
                    filteredThreads.map((thread) => {
                        const isMenuOpen = menuOpenThreadId === thread.id;
                        const isOwned = thread.is_owner;
                        const isBusy = busyThreadId === thread.id;
                        return (
                            <div
                                key={thread.id}
                                className={cn(
                                    'relative group flex items-center rounded-lg transition-colors hover:bg-surface-100 dark:hover:bg-surface-800',
                                    activeThreadId === thread.id && 'bg-surface-100 dark:bg-surface-800'
                                )}
                            >
                                <Link
                                    href={`/ai/${thread.id}`}
                                    className="flex items-center gap-3 p-3 flex-1 min-w-0"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <p className="font-medium truncate">{thread.title}</p>
                                                {thread.is_shared && (
                                                    <span className="inline-flex items-center gap-1 h-5 px-1.5 text-xs bg-accent-500/20 text-accent-600 dark:text-accent-400 rounded">
                                                        {!thread.is_owner && (
                                                            thread.shared_owner_avatar ? (
                                                                <img
                                                                    src={getStorageUrl('avatars', thread.shared_owner_avatar)}
                                                                    alt={thread.shared_owner_name || 'Shared'}
                                                                    className="h-5 w-5 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="h-5 w-5 rounded-full bg-accent-500/30 text-[9px] font-bold text-accent-700 dark:text-accent-300 flex items-center justify-center">
                                                                    {getInitials(thread.shared_owner_name || 'S')}
                                                                </span>
                                                            )
                                                        )}
                                                        共有
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-surface-500 truncate">
                                            {thread?.model?.startsWith('gemini') ? 'Gemini API' : 'OpenAI API'}
                                        </p>
                                    </div>
                                </Link>
                                <div
                                    className="ml-2 flex flex-col items-end gap-1 w-20 flex-shrink-0 self-start pt-3 pr-5 cursor-pointer"
                                    onClick={() => router.push(`/ai/${thread.id}`)}
                                >
                                    <span className="text-xs text-surface-400 whitespace-nowrap">
                                        {formatRelativeTime(thread.updated_at)}
                                    </span>
                                    <button
                                        type="button"
                                        ref={isMenuOpen ? menuButtonRef : null}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            menuAnchorRef.current = rect;
                                            setMenuPosition({ top: rect.bottom + 8, left: rect.right - 208, visibility: 'hidden' });
                                            setMenuOpenThreadId((prev) => (prev === thread.id ? null : thread.id));
                                        }}
                                        className={cn(
                                            'rounded-full p-1 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors',
                                            isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        )}
                                        aria-label="スレッドメニュー"
                                    >
                                        <EllipsisHorizontalIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                {isMenuOpen && (
                                    <div
                                        ref={menuContainerRef}
                                        className="fixed w-52 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-lg z-50 overflow-hidden text-sm divide-y divide-surface-200 dark:divide-surface-700"
                                        style={{ top: menuPosition.top, left: menuPosition.left, visibility: menuPosition.visibility }}
                                    >
                                        {isOwned && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => handleRenameThread(thread)}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <PencilIcon className="w-4 h-4 text-surface-500" />
                                                <span>名前を編集</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleCopyThreadLink(thread.id)}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            <ShareIcon className="w-4 h-4 text-surface-500" />
                                            <span>共有リンクをコピー</span>
                                        </button>
                                        {isOwned ? (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => handleDeleteThread(thread.id)}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                <span>スレッドを削除</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => handleLeaveSharedThread(thread.id)}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <UsersIcon className="w-4 h-4 text-surface-500" />
                                                <span>非表示にする</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 text-surface-400">
                        <p>スレッドがありません</p>
                        <p className="text-sm mt-1">新規スレッドを作成してAIと会話しましょう</p>
                    </div>
                )}
            </div>

            {/* Floating New Thread Button - Mobile only */}
            <button
                onClick={handleNewThread}
                disabled={creating}
                className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="新規スレッド作成"
            >
                {creating ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <PlusIcon className="w-7 h-7" />
                )}
            </button>

            {/* Mobile error toast */}
            {createError && (
                <div className="md:hidden fixed bottom-36 right-4 z-50 bg-error-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {createError}
                </div>
            )}
        </div>
    );
}
