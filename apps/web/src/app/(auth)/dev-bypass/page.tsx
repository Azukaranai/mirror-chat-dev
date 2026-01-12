'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// 開発用のアクセス/リフレッシュトークンを環境変数から読み込み
const DEV_ACCESS_TOKEN = process.env.NEXT_PUBLIC_DEV_ACCESS_TOKEN;
const DEV_REFRESH_TOKEN = process.env.NEXT_PUBLIC_DEV_REFRESH_TOKEN;

export default function DevBypassPage() {
    const router = useRouter();
    const supabase = createClient();
    const [message, setMessage] = useState('初期化中...');

    useEffect(() => {
        const run = async () => {
            if (!DEV_ACCESS_TOKEN || !DEV_REFRESH_TOKEN) {
                setMessage('開発用トークンが設定されていません。NEXT_PUBLIC_DEV_ACCESS_TOKEN / NEXT_PUBLIC_DEV_REFRESH_TOKEN をセットしてください。');
                return;
            }
            setMessage('開発用トークンでサインイン中...');
            const { data, error } = await supabase.auth.setSession({
                access_token: DEV_ACCESS_TOKEN,
                refresh_token: DEV_REFRESH_TOKEN,
            });
            if (error || !data.session) {
                console.error('Dev bypass login failed:', error);
                setMessage('サインインに失敗しました。トークンを再確認してください。');
                return;
            }
            setMessage('サインイン完了。リダイレクトします...');
            router.replace('/talk');
        };
        run();
    }, [router, supabase]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900 px-4">
            <div className="max-w-md w-full bg-white dark:bg-surface-800 shadow rounded-xl p-6 text-center space-y-3">
                <h1 className="text-xl font-semibold">Dev Bypass</h1>
                <p className="text-sm text-surface-500">{message}</p>
                {!DEV_ACCESS_TOKEN && (
                    <p className="text-xs text-error-500">
                        NEXT_PUBLIC_DEV_ACCESS_TOKEN / NEXT_PUBLIC_DEV_REFRESH_TOKEN を .env.local に設定してください
                    </p>
                )}
            </div>
        </div>
    );
}
