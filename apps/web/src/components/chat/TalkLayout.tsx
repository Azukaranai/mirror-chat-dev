'use client';

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { RoomList } from '@/components/chat/RoomList';
import { ThreadList } from '@/components/ai/ThreadList';
import { cn } from '@/lib/utils';

interface TalkLayoutProps {
    userId: string;
    children: React.ReactNode;
}

export function TalkLayout({ userId, children }: TalkLayoutProps) {
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<'chats' | 'threads'>('chats');
    const activeRoomId = useMemo(() => {
        if (!pathname) return undefined;
        const parts = pathname.split('/').filter(Boolean);
        const talkIndex = parts.indexOf('talk');
        if (talkIndex === -1) return undefined;
        return parts.length > talkIndex + 1 ? parts[talkIndex + 1] : undefined;
    }, [pathname]);

    const listClassName = activeRoomId
        ? 'hidden md:flex w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex-col'
        : 'w-full md:w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex flex-col';

    return (
        <div className="flex h-full">
            <div className={listClassName}>
                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">
                        {activeTab === 'chats' ? 'トーク' : 'AIスレッド'}
                    </h1>
                </div>
                
                {/* Tabs */}
                <div className="flex p-2 gap-2 border-b border-surface-200 dark:border-surface-800">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'chats' 
                                ? "bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-100" 
                                : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                        )}
                    >
                        チャット
                    </button>
                    <button
                        onClick={() => setActiveTab('threads')}
                        className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'threads' 
                                ? "bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-100" 
                                : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                        )}
                    >
                        AIスレッド
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'chats' ? (
                        <RoomList userId={userId} activeRoomId={activeRoomId} />
                    ) : (
                        <ThreadList userId={userId} />
                    )}
                </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
                {children}
            </div>
        </div>
    );
}
