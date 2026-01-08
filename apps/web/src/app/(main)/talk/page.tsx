import { createClient } from '@/lib/supabase/server';
import { RoomList } from '@/components/chat/RoomList';
import { EmptyChat } from '@/components/chat/EmptyChat';

export default async function TalkPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    return (
        <div className="flex h-full">
            {/* Room List - Always visible on desktop, full screen on mobile when no room selected */}
            <div className="w-full md:w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex flex-col">
                <div className="p-4 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">トーク</h1>
                </div>
                <RoomList userId={user.id} />
            </div>

            {/* Empty state for desktop when no room selected */}
            <div className="hidden md:flex flex-1 items-center justify-center bg-surface-50 dark:bg-surface-950">
                <EmptyChat />
            </div>
        </div>
    );
}
