'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials } from '@/lib/utils';

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
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

interface GroupsListProps {
    userId: string;
}

export function GroupsList({ userId }: GroupsListProps) {
    const supabase = useMemo(() => createClient(), []);
    const [groups, setGroups] = useState<Group[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch groups
    useEffect(() => {
        const fetchGroups = async () => {
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
                        const { count } = await supabase
                            .from('group_members')
                            .select('*', { count: 'exact', head: true })
                            .eq('group_id', m.groups.id);

                        // Get room for this group
                        const { data: room } = await supabase
                            .from('rooms')
                            .select('id')
                            .eq('group_id', m.groups.id)
                            .single();

                        // Safe property access
                        const groupName = Array.isArray(m.groups) ? m.groups[0].name : m.groups.name;
                        const groupAvatar = Array.isArray(m.groups) ? m.groups[0].avatar_path : m.groups.avatar_path;
                        const groupOwnerId = Array.isArray(m.groups) ? m.groups[0].owner_id : m.groups.owner_id;
                        const groupId = Array.isArray(m.groups) ? m.groups[0].id : m.groups.id;

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
            }

            setLoading(false);
        };

        fetchGroups();
    }, [supabase, userId]);

    // Create group
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            setError('グループ名を入力してください');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            // Create group
            const { data: newGroup, error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: newGroupName.trim(),
                    owner_id: userId,
                } as any)
                .select()
                .single();

            if (groupError || !newGroup) {
                setError(groupError?.message || 'グループの作成に失敗しました');
                return;
            }

            // Add owner as member
            const { error: memberError } = await supabase.from('group_members').insert({
                group_id: (newGroup as any).id,
                user_id: userId,
                role: 'owner',
            } as any);
            if (memberError) {
                setError(memberError.message || 'グループメンバーの登録に失敗しました');
                return;
            }

            // Create room for group
            const { data: newRoom, error: roomError } = await supabase
                .from('rooms')
                .insert({
                    type: 'group',
                    group_id: (newGroup as any).id,
                } as any)
                .select()
                .single();
            if (roomError || !newRoom) {
                setError(roomError?.message || 'ルームの作成に失敗しました');
                return;
            }

            // Add owner to room
            const { error: roomMemberError } = await supabase.from('room_members').insert({
                room_id: (newRoom as any).id,
                user_id: userId,
            } as any);
            if (roomMemberError) {
                setError(roomMemberError.message || 'ルームへの参加に失敗しました');
                return;
            }

            setGroups([...groups, {
                id: (newGroup as any).id,
                name: (newGroup as any).name,
                avatar_path: null,
                owner_id: userId,
                member_count: 1,
                room_id: (newRoom as any)?.id,
            }]);

            setNewGroupName('');
            setShowCreateModal(false);
        } catch {
            setError('エラーが発生しました');
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

    if (loading) {
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card p-6 w-full max-w-md animate-scale-in">
                        <h3 className="text-lg font-semibold mb-4">新規グループ作成</h3>
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="グループ名"
                            className="input mb-4"
                            autoFocus
                        />
                        {error && (
                            <div className="mb-4 p-2 rounded bg-error-500/10 text-error-600 dark:text-error-400 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewGroupName('');
                                    setError(null);
                                }}
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
                            onClick={() => handleOpenGroup(group.room_id)}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center flex-shrink-0">
                                {group.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', group.avatar_path)}
                                        alt={group.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <UsersIcon className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{group.name}</p>
                                <p className="text-xs text-surface-500">
                                    {group.member_count}人のメンバー
                                    {group.owner_id === userId && ' • オーナー'}
                                </p>
                            </div>
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
