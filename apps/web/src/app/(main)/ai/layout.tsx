'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ThreadList } from '@/components/ai/ThreadList';

export default function AILayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = useAuth();

    return (
        <div className="flex h-full">
            {/* Desktop Sidebar Navigation - Hidden on mobile */}
            <div className="hidden md:flex w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex-col">
                <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">AIスレッド</h1>
                </div>
                {userId && <ThreadList userId={userId} />}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                {children}
            </div>
        </div>
    );
}
