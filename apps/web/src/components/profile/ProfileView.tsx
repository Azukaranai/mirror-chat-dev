'use client';

import { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';

// Icons
const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
);

interface ProfileViewProps {
    profile: Profile | null;
    userId: string;
}

export function ProfileView({ profile, userId }: ProfileViewProps) {
    const supabase = useMemo(() => createClient(), []);
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [avatarPath, setAvatarPath] = useState(profile?.avatar_path || null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarUrl = avatarPath
        ? getStorageUrl('avatars', avatarPath)
        : null;

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('画像ファイルを選択してください');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('ファイルサイズは2MB以下にしてください');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            // Generate unique filename
            const ext = file.name.split('.').pop();
            const filename = `${userId}/${Date.now()}.${ext}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filename, file, { upsert: true });

            if (uploadError) {
                setError('アップロードに失敗しました');
                return;
            }

            // Update profile
            const { error: updateError } = await (supabase
                .from('profiles') as any)
                .update({ avatar_path: filename })
                .eq('user_id', userId);

            if (updateError) {
                setError('プロフィールの更新に失敗しました');
                return;
            }

            setAvatarPath(filename);
        } catch {
            setError('エラーが発生しました');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            setError('表示名を入力してください');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const { error: updateError } = await (supabase
                .from('profiles') as any)
                .update({ display_name: displayName.trim() })
                .eq('user_id', userId);

            if (updateError) {
                setError('更新に失敗しました');
                return;
            }

            setIsEditing(false);
        } catch {
            setError('エラーが発生しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="card p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Avatar */}
                <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400">
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={profile?.display_name || 'Avatar'}
                                width={96}
                                height={96}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                                {getInitials(profile?.display_name || 'U')}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleAvatarClick}
                        disabled={uploading}
                        className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                        {uploading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CameraIcon className="w-6 h-6 text-white" />
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                    />
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                    {isEditing ? (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="input"
                                placeholder="表示名"
                            />
                            <div className="flex gap-2 justify-center md:justify-start">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="btn-primary"
                                >
                                    {saving ? '保存中...' : '保存'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setDisplayName(profile?.display_name || '');
                                    }}
                                    className="btn-secondary"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <h2 className="text-xl font-bold">{profile?.display_name || 'ユーザー'}</h2>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn-icon p-1"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-surface-500 dark:text-surface-400">
                                @{profile?.handle || 'unknown'}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-4 p-3 rounded-lg bg-error-500/10 text-error-600 dark:text-error-400 text-sm">
                    {error}
                </div>
            )}
        </section>
    );
}
