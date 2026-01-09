'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ChatSplitLayout } from '@/components/chat/ChatSplitLayout';

export default function TalkRoomPage() {
    const params = useParams();
    const roomId = params?.roomId as string;
    const { userId } = useAuth();

    // AuthProviderがローディング中はここに来ない（layoutで処理済み）
    if (!userId) return null;

    return <ChatSplitLayout roomId={roomId} userId={userId} />;
}
