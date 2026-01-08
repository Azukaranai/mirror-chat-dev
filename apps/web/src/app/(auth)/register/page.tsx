'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [handle, setHandle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNotice(null);

        if (loading) return;

        // Validation
        if (password !== confirmPassword) {
            setError('パスワードが一致しません');
            return;
        }

        if (password.length < 8) {
            setError('パスワードは8文字以上で入力してください');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
            setError('IDは英数字とアンダースコアのみ使用できます');
            return;
        }

        if (handle.length < 3 || handle.length > 20) {
            setError('IDは3〜20文字で入力してください');
            return;
        }

        setLoading(true);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedHandle = handle.trim().toLowerCase();
            const normalizedDisplayName = displayName.trim();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: {
                        display_name: normalizedDisplayName,
                        handle: normalizedHandle,
                    },
                },
            });

            if (signUpError) {
                if (signUpError.message.toLowerCase().includes('already registered')) {
                    setError('このメールアドレスは既に登録されています');
                } else {
                    setError(signUpError.message);
                }
                return;
            }

            if (data.user && data.user.identities && data.user.identities.length === 0) {
                setError('このメールアドレスは既に登録されています');
                return;
            }

            if (!data.session) {
                setNotice('確認メールを送信しました。メールを確認して登録を完了してください。');
            } else {
                router.push('/talk');
                router.refresh();
            }
        } catch {
            setError('登録中にエラーが発生しました');
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
                    新規アカウント作成
                </p>
            </div>

            {/* Register Form */}
            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
                        表示名
                    </label>
                    <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="input"
                        placeholder="山田太郎"
                        required
                        disabled={loading}
                    />
                </div>

                <div>
                    <label htmlFor="handle" className="block text-sm font-medium mb-1.5">
                        ユーザーID
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
                            @
                        </span>
                        <input
                            id="handle"
                            type="text"
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            className="input pl-8"
                            placeholder="taro_yamada"
                            required
                            disabled={loading}
                            pattern="^[a-zA-Z0-9_]+$"
                            minLength={3}
                            maxLength={20}
                        />
                    </div>
                    <p className="mt-1 text-xs text-surface-500">
                        英数字とアンダースコアのみ（3〜20文字）
                    </p>
                </div>

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
                        minLength={8}
                    />
                    <p className="mt-1 text-xs text-surface-500">
                        8文字以上
                    </p>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">
                        パスワード（確認）
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                {notice && (
                    <div className="p-3 rounded-lg bg-success-500/10 text-success-600 dark:text-success-400 text-sm">
                        {notice}
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
                            登録中...
                        </span>
                    ) : (
                        'アカウント作成'
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

            {/* Login Link */}
            <p className="text-center text-sm text-surface-600 dark:text-surface-400">
                既にアカウントをお持ちの方は{' '}
                <Link
                    href="/login"
                    className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                    ログイン
                </Link>
            </p>
        </div>
    );
}
