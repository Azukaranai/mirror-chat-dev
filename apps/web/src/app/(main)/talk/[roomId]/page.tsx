import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { RoomList } from '@/components/chat/RoomList';
import { ChatSplitLayout } from '@/components/chat/ChatSplitLayout';

interface TalkRoomPageProps {
    params: Promise<{ roomId: string }>;
}

export default async function TalkRoomPage({ params }: TalkRoomPageProps) {
    const { roomId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Verify room membership
    const { data: membership } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

    if (!membership) {
        notFound();
    }

    return (
        <div className="flex h-full">
            {/* Room List - Hidden on mobile when room is selected */}
            <div className="hidden md:flex w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex-col">
                <div className="p-4 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">トーク</h1>
                </div>
                <RoomList userId={user.id} activeRoomId={roomId} />
            </div>

            {/* Chat Room */}
            <div className="flex-1 flex flex-col min-w-0">
                <ChatSplitLayout roomId={roomId} userId={user.id} />
            </div>
        </div>
    );
}
