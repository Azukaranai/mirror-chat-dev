'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AIThreadView } from '@/components/ai/AIThreadView';
import type { AIThread } from '@/types/database';

interface AIThreadPanelProps {
    threadId: string;
    variant?: 'page' | 'embedded';
}

export function AIThreadPanel({ threadId, variant = 'embedded' }: AIThreadPanelProps) {
    const supabase = useMemo(() => createClient(), []);
    const [userId, setUserId] = useState<string | null>(null);
    const [thread, setThread] = useState<AIThread | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [permission, setPermission] = useState<'VIEW' | 'INTERVENE' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUserId(null);
                setLoading(false);
                return;
            }

            setUserId(user.id);

            const { data: threadData } = await supabase
                .from('ai_threads')
                .select('*')
                .eq('id', threadId)
                .single();

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
                    setPermission((membership as any)?.permission || null);
                } else {
                    setPermission('INTERVENE');
                }
                setLoading(false);
                return;
            }

            const { data: membership } = await supabase
                .from('ai_thread_members')
                .select('permission, ai_threads!inner(*)')
                .eq('thread_id', threadId)
                .eq('user_id', user.id)
                .single();

            if (membership) {
                const joinedThread = Array.isArray((membership as any).ai_threads)
                    ? (membership as any).ai_threads[0]
                    : (membership as any).ai_threads;
                setThread((joinedThread as AIThread) || null);
                setIsOwner(false);
                setPermission((membership as any).permission || null);
            }

            setLoading(false);
        };

        load();
    }, [supabase, threadId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!userId || !thread) {
        return (
            <div className="flex-1 flex items-center justify-center text-surface-400">
                スレッドを読み込めませんでした
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
