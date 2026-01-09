'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
);

interface EmptyThreadProps {
    userId: string;
}

export function EmptyThread({ userId }: EmptyThreadProps) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        setCreating(true);
        const supabase = createClient();

        // Determine initial model based on available keys
        let initialModel = 'gpt-5.2'; // Default
        try {
            const { data: keys } = await supabase
                .from('user_llm_keys')
                .select('provider')
                .eq('user_id', userId);

            const providers = new Set(keys?.map((k: any) => k.provider) || []);

            if (providers.has('openai')) {
                initialModel = 'gpt-5.2';
            } else if (providers.has('google')) {
                initialModel = 'gemini-3.0';
            }
        } catch (e) {
            // Ignore error
        }

        const { data: newThread, error } = await supabase
            .from('ai_threads')
            .insert({
                owner_user_id: userId,
                title: '新規スレッド',
                model: initialModel,
            } as any)
            .select()
            .single();

        if (!error && newThread) {
            router.push(`/ai/${(newThread as any).id}`);
        } else {
            console.error('Failed to create thread:', error);
            setCreating(false);
        }
    };

    return (
        <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent-100 to-primary-100 dark:from-accent-900/30 dark:to-primary-900/30 flex items-center justify-center">
                <SparklesIcon className="w-8 h-8 text-accent-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">AIスレッドを選択</h3>
            <p className="text-surface-500 dark:text-surface-400 text-sm mb-4">
                左のリストからスレッドを選択するか、
                <br />
                新しいAIスレッドを作成しましょう
            </p>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">
                {creating ? (
                    <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        作成中...
                    </span>
                ) : (
                    '新規スレッドを作成'
                )}
            </button>
        </div>
    );
}
