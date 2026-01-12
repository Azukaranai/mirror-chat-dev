'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { RoomList } from '@/components/chat/RoomList';

interface TalkLayoutProps {
    userId: string;
    children: React.ReactNode;
}

export function TalkLayout({ userId, children }: TalkLayoutProps) {
    const pathname = usePathname();
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
                <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">トーク</h1>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <RoomList userId={userId} activeRoomId={activeRoomId} />
                </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
                {children}
            </div>
        </div>
    );
}
