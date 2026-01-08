import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ThreadList } from '@/components/ai/ThreadList';
import { AIThreadView } from '@/components/ai/AIThreadView';
import type { AIThread } from '@/types/database';

interface AIThreadPageProps {
    params: Promise<{ threadId: string }>;
}

export default async function AIThreadPage({ params }: AIThreadPageProps) {
    const { threadId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Verify thread access - cast to AIThread type
    const { data: threadData } = await supabase
        .from('ai_threads')
        .select('*')
        .eq('id', threadId)
        .single();

    let thread = threadData as AIThread | null;
    let permission: 'VIEW' | 'INTERVENE' | null = null;

    if (!thread) {
        // Check if user is a member
        const { data: membership } = await supabase
            .from('ai_thread_members')
            .select('permission, ai_threads!inner(*)')
            .eq('thread_id', threadId)
            .eq('user_id', user.id)
            .single();

        if (!membership) {
            notFound();
        }

        permission = (membership as any).permission || null;
        const joinedThread = Array.isArray((membership as any).ai_threads)
            ? (membership as any).ai_threads[0]
            : (membership as any).ai_threads;
        thread = (joinedThread as AIThread) || null;
    } else if (thread.owner_user_id !== user.id) {
        const { data: membership } = await supabase
            .from('ai_thread_members')
            .select('permission')
            .eq('thread_id', threadId)
            .eq('user_id', user.id)
            .single();
        permission = (membership as any)?.permission || null;
    }

    const isOwner = thread ? thread.owner_user_id === user.id : false;

    return (
        <div className="flex h-full">
            {/* Thread List - Hidden on mobile */}
            <div className="hidden md:flex w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex-col">
                <div className="p-4 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">AIスレッド</h1>
                </div>
                <ThreadList userId={user.id} activeThreadId={threadId} />
            </div>

            {/* Thread View */}
            <div className="flex-1 flex flex-col min-w-0">
                <AIThreadView
                    threadId={threadId}
                    userId={user.id}
                    isOwner={isOwner}
                    thread={thread}
                    permission={permission}
                />
            </div>
        </div>
    );
}
