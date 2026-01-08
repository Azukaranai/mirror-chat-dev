import { createClient } from '@/lib/supabase/server';
import { ThreadList } from '@/components/ai/ThreadList';
import { EmptyThread } from '@/components/ai/EmptyThread';

export default async function AIPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    return (
        <div className="flex h-full">
            {/* Thread List */}
            <div className="w-full md:w-80 lg:w-96 border-r border-surface-200 dark:border-surface-800 flex flex-col">
                <div className="p-4 border-b border-surface-200 dark:border-surface-800">
                    <h1 className="text-xl font-bold">AIスレッド</h1>
                </div>
                <ThreadList userId={user.id} />
            </div>

            {/* Empty state for desktop */}
            <div className="hidden md:flex flex-1 items-center justify-center bg-surface-50 dark:bg-surface-950">
                <EmptyThread />
            </div>
        </div>
    );
}
