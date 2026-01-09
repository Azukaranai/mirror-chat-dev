'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AIThreadView } from '@/components/ai/AIThreadView';
import { useCacheStore } from '@/lib/stores';
import type { AIThread } from '@/types/database';

interface AIThreadPanelProps {
    threadId: string;
    variant?: 'page' | 'embedded';
}

export function AIThreadPanel({ threadId, variant = 'embedded' }: AIThreadPanelProps) {
    const supabase = useMemo(() => createClient(), []);
    const { threadCache, setThreadCache } = useCacheStore();
    const cached = threadCache.get(threadId);

    const [userId, setUserId] = useState<string | null>(cached?.userId || null);
    const [thread, setThread] = useState<AIThread | null>(cached?.thread || null);
    const [isOwner, setIsOwner] = useState(cached?.isOwner || false);
    const [permission, setPermission] = useState<'VIEW' | 'INTERVENE' | null>(cached?.permission || null);
    const [loading, setLoading] = useState(!cached);
    const [error, setError] = useState<string | null>(null);

    const fetchThread = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUserId(null);
                setLoading(false);
                return;
            }

            setUserId(user.id);

            // Try direct thread access (Owner)
            const { data: threadData } = await supabase
                .from('ai_threads')
                .select('*')
                .eq('id', threadId)
                .maybeSingle();

            if (threadData) {
                const typedThread = threadData as AIThread;
                setThread(typedThread);
                const owner = typedThread.owner_user_id === user.id;
                setIsOwner(owner);
                if (!owner) {
                    const { data: membership } = await supabase
                        .from('ai_thread_members')
                        .select('permission')
                        .eq('thread_id', threadId)
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (!membership) {
                        // Thread exists but not owner and no membership?
                        // Maybe public thread logic if implemented, otherwise error
                        // For now, assume if you can see threadData you have access (RLS)
                        // But we need permission.
                        setPermission(null);
                    } else {
                        setPermission((membership as any)?.permission || null);
                    }
                } else {
                    setPermission('INTERVENE');
                }

                // Update cache
                setThreadCache(threadId, {
                    userId: user.id,
                    thread: typedThread,
                    isOwner: owner,
                    permission: owner ? 'INTERVENE' : (permission || null)
                });

                setLoading(false);
                return;
            }

            // Fallback: Check membership if direct access failed (maybe RLS hid it)
            const { data: membership } = await supabase
                .from('ai_thread_members')
                .select('permission, ai_threads!inner(*)')
                .eq('thread_id', threadId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (membership) {
                const joinedThread = Array.isArray((membership as any).ai_threads)
                    ? (membership as any).ai_threads[0]
                    : (membership as any).ai_threads;
                setThread((joinedThread as AIThread) || null);
                setIsOwner(false);
                const perm = (membership as any).permission || null;
                setPermission(perm);

                // Update cache
                setThreadCache(threadId, {
                    userId: user.id,
                    thread: (joinedThread as AIThread) || null,
                    isOwner: false,
                    permission: perm
                });

                setLoading(false);
                return;
            }

            setError('スレッドが見つからないか、削除されました');
        } catch (e: any) {
            console.error('Thread load error:', e);
            setError('読み込み中にエラーが発生しました');
        } finally {
            setLoading(false);
        }
    }, [supabase, threadId]);

    useEffect(() => {
        fetchThread();
    }, [fetchThread]);

    if (loading) {
        return (
            <div className="flex-1 h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleJoin = async () => {
        if (!userId) return;
        setLoading(true);
        const { error } = await supabase
            .from('ai_thread_members')
            .insert({
                thread_id: threadId,
                user_id: userId,
                permission: 'VIEW'
            } as any);

        if (error) {
            console.error('Join error:', error);
            setError('参加に失敗しました。オーナーに招待を依頼してください。');
            setLoading(false);
        } else {
            fetchThread();
        }
    };

    if (error || !userId || !thread) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-4 text-center">
                <p className="text-surface-500 mb-4">{error || 'スレッドにアクセスする権限がないか、存在しません'}</p>
                <div className="flex gap-2">
                    <button
                        onClick={fetchThread}
                        className="btn-secondary"
                    >
                        再読み込み
                    </button>
                    {!thread && !error?.includes('参加に失敗') && (
                        <button
                            onClick={handleJoin}
                            className="bg-primary-500 hover:bg-primary-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            参加を試行
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <AIThreadView
            threadId={threadId}
            userId={userId}
            isOwner={isOwner}
            thread={thread}
            permission={permission}
            variant={variant}
        />
    );
}
