'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials } from '@/lib/utils';
import {
    PlusIcon,
    UsersIcon,
    PhotoIcon,
    XMarkIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const ChatBubbleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
);

interface Group {
    id: string;
    name: string;
    avatar_path: string | null;
    owner_id: string;
    member_count: number;
    room_id?: string;
}

interface Friend {
    id: string;
    displayName: string;
    nickname?: string | null;
    avatarPath: string | null;
    username: string;
}

interface GroupsListProps {
    userId: string;
}

export function GroupsList({ userId }: GroupsListProps) {
    const supabase = useMemo(() => createClient(), []);
    const [groups, setGroups] = useState<Group[]>([]);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Member Selection State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch groups
    const fetchGroups = useCallback(async () => {
        setLoading(true);

        const { data: memberOf } = await supabase
            .from('group_members')
            .select(`
                group_id,
                groups!inner(id, name, avatar_path, owner_id)
            `)
            .eq('user_id', userId);

        if (memberOf) {
            const groupsWithCounts = await Promise.all(
                memberOf.map(async (m: any) => {
                    const groupId = Array.isArray(m.groups) ? m.groups[0].id : m.groups.id;

                    const { count } = await supabase
                        .from('group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', groupId);

                    // Get room for this group
                    const { data: room } = await supabase
                        .from('rooms')
                        .select('id')
                        .eq('group_id', groupId)
                        .single();

                    // Safe property access
                    const groupName = Array.isArray(m.groups) ? m.groups[0].name : m.groups.name;
                    const groupAvatar = Array.isArray(m.groups) ? m.groups[0].avatar_path : m.groups.avatar_path;
                    const groupOwnerId = Array.isArray(m.groups) ? m.groups[0].owner_id : m.groups.owner_id;

                    return {
                        id: groupId,
                        name: groupName,
                        avatar_path: groupAvatar,
                        owner_id: groupOwnerId,
                        member_count: count || 0,
                        room_id: (room as any)?.id,
                    };
                })
            );
            setGroups(groupsWithCounts);
        } else {
            setGroups([]);
        }

        setLoading(false);
    }, [supabase, userId]);

    // Fetch friends for selection
    useEffect(() => {
        const fetchFriends = async () => {
            if (!userId) return;

            try {
                const { data: rels, error: relError } = await supabase
                    .from('friendships')
                    .select('requester_id, addressee_id, requester_nickname, addressee_nickname')
                    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
                    .eq('status', 'accepted');

                if (relError) throw relError;

                if (!rels || rels.length === 0) {
                    setFriends([]);
                    return;
                }

                const nicknameMap = new Map<string, string>();
                const friendIds = rels.map((r: any) => {
                    const isRequester = r.requester_id === userId;
                    const friendId = isRequester ? r.addressee_id : r.requester_id;
                    const nickname = isRequester ? r.requester_nickname : r.addressee_nickname;
                    if (friendId && nickname) {
                        nicknameMap.set(friendId, nickname);
                    }
                    return friendId;
                });

                const { data: profiles, error: profError } = await supabase
                    .from('profiles')
                    .select('user_id, display_name, avatar_path, handle')
                    .in('user_id', friendIds);

                if (profError) throw profError;

                if (profiles) {
                    const list = profiles.map((p: any) => ({
                        id: p.user_id,
                        displayName: p.display_name,
                        nickname: nicknameMap.get(p.user_id) || null,
                        avatarPath: p.avatar_path,
                        username: p.handle
                    }));
                    setFriends(list as Friend[]);
                }
            } catch (err) {
                console.error('Error fetching friends:', err);
            }
        };
        fetchFriends();
    }, [supabase, userId]);

    // Initial load
    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // Reset modal state
    const resetModal = () => {
        setNewGroupName('');
        setAvatarFile(null);
        setAvatarPreview(null);
        setSelectedMemberIds([]);
        setSearchQuery('');
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation (e.g. size)
        if (file.size > 5 * 1024 * 1024) {
            setError('画像サイズは5MB以下にしてください');
            return;
        }

        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
        setError(null);
    };

    const handleToggleMember = (id: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            setError('グループ名を入力してください');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            let avatarPath = null;
            if (avatarFile) {
                const ext = avatarFile.name.split('.').pop();
                const fileName = `${userId}/group_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile);
                if (uploadError) throw uploadError;
                avatarPath = fileName;
            }

            // Use the updated RPC function that accepts initial members
            const { data, error: rpcError } = await supabase.rpc('create_group_with_owner', {
                p_name: newGroupName.trim(),
                p_avatar_path: avatarPath,
                p_initial_members: selectedMemberIds
            } as any);

            if (rpcError) {
                throw rpcError;
            }

            // Success
            resetModal();
            setShowCreateModal(false);
            fetchGroups(); // Refresh list

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'グループの作成に失敗しました');
        } finally {
            setCreating(false);
        }
    };

    // Open group chat
    const handleOpenGroup = (roomId?: string) => {
        if (roomId) {
            window.location.href = `/talk/${roomId}`;
        }
    };

    const filteredFriends = friends.filter(f => {
        const friendName = (f.nickname || f.displayName).toLowerCase();
        const query = searchQuery.toLowerCase();
        return friendName.includes(query) || f.username.toLowerCase().includes(query);
    });

    if (loading && groups.length === 0) {
        return <div className="text-center py-8 text-surface-400">読み込み中...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Create Group Button */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="btn-secondary w-full justify-center"
            >
                <PlusIcon className="w-5 h-5" />
                グループを作成
            </button>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md animate-scale-in max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">新規グループ作成</h3>
                            <button onClick={() => { setShowCreateModal(false); resetModal(); }} className="text-surface-500 hover:text-surface-700">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Avatar Upload */}
                            <div className="flex justify-center mb-6">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800 flex items-center justify-center border-2 border-dashed border-surface-300 dark:border-surface-600 hover:border-primary-500 transition-colors">
                                        {avatarPreview ? (
                                            <Image
                                                src={avatarPreview}
                                                alt="Preview"
                                                width={96}
                                                height={96}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <PhotoIcon className="w-8 h-8 text-surface-400" />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <PlusIcon className="w-8 h-8 text-white" />
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>

                            {/* Group Name */}
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="グループ名"
                                className="input mb-6 w-full"
                            />

                            {/* Members Selection */}
                            <div className="mb-2">
                                <h4 className="text-sm font-medium text-surface-500 mb-2">メンバーを追加 ({selectedMemberIds.length})</h4>
                                <div className="relative mb-2">
                                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                    <input
                                        type="text"
                                        placeholder="友達を検索..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="input pl-9 py-1 text-sm"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 border border-surface-200 dark:border-surface-700 rounded-lg p-1">
                                    {filteredFriends.length > 0 ? filteredFriends.map(friend => {
                                        const isSelected = selectedMemberIds.includes(friend.id);
                                        const friendName = friend.nickname || friend.displayName;
                                        return (
                                            <div
                                                key={friend.id}
                                                onClick={() => handleToggleMember(friend.id)}
                                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full overflow-hidden relative flex-shrink-0 flex items-center justify-center text-xs font-bold ${friend.avatarPath ? 'bg-surface-200' : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'}`}>
                                                    {friend.avatarPath ? (
                                                        <Image src={getStorageUrl('avatars', friend.avatarPath)} alt="" fill className="object-cover" />
                                                    ) : (
                                                        <span>{getInitials(friendName)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{friendName}</p>
                                                    <p className="text-xs text-surface-500 truncate">@{friend.username}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-surface-300 dark:border-surface-600'}`}>
                                                    {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="text-center py-4 text-xs text-surface-500">
                                            {searchQuery ? '見つかりませんでした' : '友達がいません'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded bg-error-500/10 text-error-600 dark:text-error-400 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-surface-200 dark:border-surface-700 flex gap-2 justify-end bg-surface-50 dark:bg-surface-900/50 rounded-b-xl">
                            <button
                                onClick={() => { setShowCreateModal(false); resetModal(); }}
                                className="btn-secondary"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={creating}
                                className="btn-primary"
                            >
                                {creating ? '作成中...' : '作成'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Groups List */}
            {groups.length > 0 ? (
                <div className="space-y-2">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center flex-shrink-0 relative">
                                {group.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', group.avatar_path)}
                                        alt={group.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <UsersIcon className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                    {group.name}
                                    <span className="ml-1">（{group.member_count}）</span>
                                </p>
                            </div>
                            <button
                                onClick={() => handleOpenGroup(group.room_id)}
                                className="btn-icon p-1.5 ml-auto"
                                title="トーク"
                            >
                                <ChatBubbleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-surface-400">
                    <p>グループがありません</p>
                    <p className="text-sm mt-1">グループを作成して友達を招待しましょう</p>
                </div>
            )}
        </div>
    );
}
