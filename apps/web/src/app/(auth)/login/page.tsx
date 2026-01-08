'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                router.push('/talk');
                router.refresh();
            }
        } catch {
            setError('ログイン中にエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card p-8 animate-fade-in">
            {/* Logo */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold gradient-text mb-2">Mirror Chat</h1>
                <p className="text-surface-500 dark:text-surface-400">
                    AIチャット共有プラットフォーム
                </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                        メールアドレス
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input"
                        placeholder="you@example.com"
                        required
                        disabled={loading}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                        パスワード
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-error-500/10 text-error-600 dark:text-error-400 text-sm">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            ログイン中...
                        </span>
                    ) : (
                        'ログイン'
                    )}
                </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-surface-200 dark:border-surface-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-surface-900 text-surface-500">
                        または
                    </span>
                </div>
            </div>

            {/* Register Link */}
            <p className="text-center text-sm text-surface-600 dark:text-surface-400">
                アカウントをお持ちでない方は{' '}
                <Link
                    href="/register"
                    className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                    新規登録
                </Link>
            </p>
        </div>
    );
}
