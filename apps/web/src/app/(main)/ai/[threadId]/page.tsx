'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { AIThreadView } from '@/components/ai/AIThreadView';

export default function AIThreadPage() {
    const params = useParams();
    const threadId = params?.threadId as string;
    const { userId } = useAuth();

    // AuthProviderがローディング中はここに来ない（layoutで処理済み）
    if (!userId) return null;

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 flex flex-col min-w-0">
                <AIThreadView
                    threadId={threadId}
                    userId={userId}
                    isOwner={false}
                    thread={null}
                    permission={null}
                />
            </div>
        </div>
    );
}
