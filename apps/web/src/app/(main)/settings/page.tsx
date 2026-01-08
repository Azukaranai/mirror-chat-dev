'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUIStore } from '@/lib/stores';
import type { FontScale, Theme } from '@/types';

export default function SettingsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const { theme, setTheme, fontScale, setFontScale } = useUIStore();
    const [apiKey, setApiKey] = useState('');
    const [apiKeyLast4, setApiKeyLast4] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fontScaleOptions: { value: FontScale; label: string }[] = [
        { value: 0.8, label: '極小' },
        { value: 0.9, label: '小' },
        { value: 1, label: '標準' },
        { value: 1.1, label: '大' },
        { value: 1.2, label: '極大' },
    ];

    const themeOptions: { value: Theme; label: string }[] = [
        { value: 'light', label: 'ライト' },
        { value: 'dark', label: 'ダーク' },
        { value: 'system', label: 'システム設定' },
    ];

    useEffect(() => {
        let canceled = false;

        const loadApiKey = async () => {
            const { data, error } = await supabase
                .from('user_llm_keys')
                .select('key_last4')
                .maybeSingle();

            const keyLast4 = (data as { key_last4?: string } | null)?.key_last4;

            if (!canceled && !error && keyLast4) {
                setApiKeyLast4(keyLast4);
            }
        };

        loadApiKey();

        return () => {
            canceled = true;
        };
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) return;

        setSaving(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.functions.invoke('key_set', {
                body: { apiKey: apiKey.trim() },
            });

            if (error) {
                setMessage({ type: 'error', text: 'APIキーの保存に失敗しました' });
            } else {
                setApiKeyLast4(data.last4);
                setApiKey('');
                setMessage({ type: 'success', text: 'APIキーを保存しました' });
            }
        } catch {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteApiKey = async () => {
        if (!confirm('APIキーを削除しますか？')) return;

        setSaving(true);

        try {
            const { error } = await supabase.functions.invoke('key_delete');

            if (error) {
                setMessage({ type: 'error', text: '削除に失敗しました' });
            } else {
                setApiKeyLast4(null);
                setMessage({ type: 'success', text: 'APIキーを削除しました' });
            }
        } catch {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setSaving(false);
        }
    };

    // Apply font scale
    const handleFontScaleChange = (scale: FontScale) => {
        setFontScale(scale);
        document.documentElement.style.setProperty('--font-scale', scale.toString());
    };

    // Apply theme
    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // System preference
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                <h1 className="text-2xl font-bold">設定</h1>

                {/* Appearance */}
                <section className="card p-4 md:p-6 space-y-4">
                    <h2 className="text-lg font-semibold">外観</h2>

                    {/* Theme */}
                    <div>
                        <label className="block text-sm font-medium mb-2">テーマ</label>
                        <div className="flex gap-2">
                            {themeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleThemeChange(option.value)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === option.value
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Size */}
                    <div>
                        <label className="block text-sm font-medium mb-2">文字サイズ</label>
                        <div className="flex gap-2">
                            {fontScaleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleFontScaleChange(option.value)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${fontScale === option.value
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* API Key */}
                <section className="card p-4 md:p-6 space-y-4">
                    <h2 className="text-lg font-semibold">OpenAI APIキー</h2>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                        AIスレッド機能を使用するには、OpenAIのAPIキーが必要です。
                        キーはサーバーで暗号化して保存されます。
                    </p>

                    {apiKeyLast4 && (
                        <div className="flex items-center gap-2 p-3 bg-success-500/10 rounded-lg">
                            <span className="text-success-600 dark:text-success-400">✓</span>
                            <span className="text-sm">
                                APIキーが登録されています（末尾: ...{apiKeyLast4}）
                            </span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="input flex-1"
                        />
                        <button
                            onClick={handleSaveApiKey}
                            disabled={saving || !apiKey.trim()}
                            className="btn-primary"
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>

                    {apiKeyLast4 && (
                        <button
                            onClick={handleDeleteApiKey}
                            disabled={saving}
                            className="btn-danger"
                        >
                            APIキーを削除
                        </button>
                    )}

                    {message && (
                        <div
                            className={`p-3 rounded-lg text-sm ${message.type === 'success'
                                ? 'bg-success-500/10 text-success-600 dark:text-success-400'
                                : 'bg-error-500/10 text-error-600 dark:text-error-400'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}
                </section>

                {/* Account */}
                <section className="card p-4 md:p-6 space-y-4">
                    <h2 className="text-lg font-semibold">アカウント</h2>

                    <button
                        onClick={handleLogout}
                        className="btn-secondary w-full"
                    >
                        ログアウト
                    </button>
                </section>
            </div>
        </div>
    );
}
