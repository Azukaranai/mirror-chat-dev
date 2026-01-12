'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ThreadList } from '@/components/ai/ThreadList';
import { EmptyThread } from '@/components/ai/EmptyThread';

export default function AIPage() {
    const { userId } = useAuth();

    if (!userId) return null;

    return (
        <div className="h-full w-full">
            {/* Mobile: Show Thread List (takes full height) */}
            <div className="md:hidden flex flex-col h-full w-full">
                <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">AIスレッド</h1>
                </div>
                <ThreadList userId={userId} />
            </div>

            {/* Desktop: Show Empty State (Layout handles sidebar) */}
            <div className="hidden md:flex flex-col h-full items-center justify-center bg-surface-50 dark:bg-surface-950">
                <EmptyThread userId={userId} />
            </div>
        </div>
    );
}
