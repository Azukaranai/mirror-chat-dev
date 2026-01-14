'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUIStore } from '@/lib/stores';
import type { FontScale, Theme } from '@/types';
import { VersionDisplay } from '@/components/common/VersionDisplay';
import { encryptApiKeyClientSide } from '@/lib/crypto';

export default function SettingsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const { theme, setTheme, fontScale, setFontScale } = useUIStore();

    const [provider, setProvider] = useState<'openai' | 'google'>('openai');
    const [apiKey, setApiKey] = useState('');
    const [savedKeys, setSavedKeys] = useState<{ openai?: string; google?: string }>({});
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

    const providerOptions = [
        { value: 'openai', label: 'OpenAI (GPT-5.2)' },
        { value: 'google', label: 'Google (Gemini 2.5 Flash)' },
    ];

    useEffect(() => {
        let canceled = false;

        const loadApiKeys = async () => {
            const { data, error } = await supabase
                .from('user_llm_keys')
                .select('provider, key_last4');

            if (!canceled && !error && data) {
                const keys: { openai?: string; google?: string } = {};
                data.forEach((row: any) => {
                    if (row.provider === 'openai' || row.provider === 'google') {
                        keys[row.provider as 'openai' | 'google'] = row.key_last4;
                    }
                });
                setSavedKeys(keys);
            }
        };

        loadApiKeys();

        return () => {
            canceled = true;
        };
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleForceResetSession = async () => {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (supabaseUrl) {
                const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
                if (projectRef) {
                    localStorage.removeItem(`sb-${projectRef}-auth-token`);
                }
            }
        } catch {
            // ignore
        }
        await supabase.auth.signOut({ scope: 'global' });
        router.push('/login');
        router.refresh();
    };

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) return;

        setSaving(true);
        setMessage(null);

        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (!userId) {
                setMessage({ type: 'error', text: 'ユーザー情報の取得に失敗しました' });
                return;
            }

            const trimmedKey = apiKey.trim();
            const encryptedKey = await encryptApiKeyClientSide(trimmedKey, userId);
            const last4 = trimmedKey.slice(-4);

            const { error } = await supabase
                .from('user_llm_keys')
                .upsert(
                    { user_id: userId, provider, encrypted_key: encryptedKey, key_last4: last4 },
                    { onConflict: 'user_id,provider' }
                );

            if (error) {
                console.error('DB error:', error);
                setMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` });
                return;
            }

            setSavedKeys(prev => ({ ...prev, [provider]: last4 }));
            setApiKey('');
            setMessage({ type: 'success', text: `${providerOptions.find(p => p.value === provider)?.label} のAPIキーを保存しました` });
        } catch (e) {
            console.error('Unexpected error:', e);
            const messageText = e instanceof Error ? e.message : 'エラーが発生しました';
            setMessage({ type: 'error', text: messageText });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteApiKey = async () => {
        if (!confirm('APIキーを削除しますか？')) return;

        setSaving(true);

        try {
            // Note: key_delete function needs update to accept provider or we need new function
            // For now, let's assume we update key_delete or just use raw delete here?
            // Safer to use function but function needs update. 
            // Let's implement direct delete here for simplicity as we have RLS?
            // Actually RLS allows delete own keys.
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) {
                setMessage({ type: 'error', text: 'ユーザー情報の取得に失敗しました' });
                return;
            }

            const { error } = await supabase
                .from('user_llm_keys')
                .delete()
                .eq('user_id', userId)
                .eq('provider', provider);

            if (error) {
                setMessage({ type: 'error', text: '削除に失敗しました' });
            } else {
                setSavedKeys(prev => {
                    const next = { ...prev };
                    delete next[provider as 'openai' | 'google'];
                    return next;
                });
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
    };

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
    };

    const currentKeyLast4 = savedKeys[provider as 'openai' | 'google'];

    return (
        <div className="flex-1 overflow-auto">
            <div className="flex items-center px-4 h-14 border-b border-surface-200 dark:border-surface-800">
                <h1 className="text-xl font-bold">設定</h1>
            </div>
            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">

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
                    <h2 className="text-lg font-semibold">AI APIキー設定</h2>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                        使用するAIモデルのプロバイダーを選択し、APIキーを設定してください。
                    </p>

                    {/* Provider Tabs */}
                    <div className="flex border-b border-surface-200 dark:border-surface-700">
                        {providerOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setProvider(opt.value as any);
                                    setMessage(null);
                                    setApiKey('');
                                }}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${provider === opt.value
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="pt-2">
                        {currentKeyLast4 ? (
                            <div className="flex items-center gap-2 p-3 bg-success-500/10 rounded-lg mb-4">
                                <span className="text-success-600 dark:text-success-400">✓</span>
                                <span className="text-sm">
                                    {providerOptions.find(p => p.value === provider)?.label} のキーが登録されています（末尾: ...{currentKeyLast4}）
                                </span>
                            </div>
                        ) : (
                            <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg mb-4 text-sm text-surface-500">
                                {provider === 'openai' ? (
                                    <>OpenAI APIキー (sk-...) を入力してください。<br />ChatGPT PlusではなくAPIのクレジットが必要です。</>
                                ) : (
                                    <>Google Gemini APIキーを入力してください。<br />Google AI Studioで無料で取得可能です。</>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={provider === 'openai' ? "sk-..." : "AI..."}
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

                        {currentKeyLast4 && (
                            <div className="mt-4">
                                <button
                                    onClick={handleDeleteApiKey}
                                    disabled={saving}
                                    className="btn-danger text-sm"
                                >
                                    このキーを削除
                                </button>
                            </div>
                        )}
                    </div>

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
                    <button
                        onClick={handleForceResetSession}
                        className="btn-secondary w-full text-error-600 dark:text-error-400"
                    >
                        セッションを強制リセット
                    </button>
                </section>

                <div className="text-center">
                    <VersionDisplay className="text-xs text-surface-400 dark:text-surface-600" />
                </div>
            </div>
        </div>
    );
}
