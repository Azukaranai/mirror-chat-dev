import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
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
        <ChatSplitLayout roomId={roomId} userId={user.id} />
    );
}
