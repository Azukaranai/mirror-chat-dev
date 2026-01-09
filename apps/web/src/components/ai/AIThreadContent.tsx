import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { AIThreadView } from './AIThreadView';
import type { AIThread } from '@/types/database';

interface AIThreadContentProps {
    threadId: string;
    userId: string;
}

export async function AIThreadContent({ threadId, userId }: AIThreadContentProps) {
    const supabase = await createClient();

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
            .eq('user_id', userId)
            .single();

        if (!membership) {
            notFound();
        }

        permission = (membership as any).permission || null;
        const joinedThread = Array.isArray((membership as any).ai_threads)
            ? (membership as any).ai_threads[0]
            : (membership as any).ai_threads;
        thread = (joinedThread as AIThread) || null;
    } else if (thread.owner_user_id !== userId) {
        const { data: membership } = await supabase
            .from('ai_thread_members')
            .select('permission')
            .eq('thread_id', threadId)
            .eq('user_id', userId)
            .single();
        permission = (membership as any)?.permission || null;
    }

    const isOwner = thread ? thread.owner_user_id === userId : false;

    return (
        <AIThreadView
            threadId={threadId}
            userId={userId}
            isOwner={isOwner}
            thread={thread}
            permission={permission}
        />
    );
}
