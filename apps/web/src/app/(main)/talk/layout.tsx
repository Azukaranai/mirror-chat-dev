'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { TalkLayout } from '@/components/chat/TalkLayout';

export default function TalkRootLayout({ children }: { children: React.ReactNode }) {
    const { userId } = useAuth();

    if (!userId) return null;

    return <TalkLayout userId={userId}>{children}</TalkLayout>;
}
