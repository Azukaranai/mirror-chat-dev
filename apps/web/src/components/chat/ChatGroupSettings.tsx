'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials } from '@/lib/utils';
import {
    XMarkIcon,
    UserPlusIcon,
    PencilIcon,
    PhotoIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    UserGroupIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface ChatGroupSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
    groupId?: string;
    userId: string;
    initialView?: 'members' | 'invite' | 'settings';
}

interface Member {
    user_id: string;
    role: string;
    display_name: string;
    handle: string;
    avatar_path: string | null;
}

interface Friend {
    id: string;
    displayName: string;
    avatarPath: string | null;
    handle: string;
}

export function ChatGroupSettings({ isOpen, onClose, roomId, groupId, userId, initialView = 'members' }: ChatGroupSettingsProps) {
    const supabase = useMemo(() => createClient() as any, []);
    const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');

    // Group Data
    const [groupName, setGroupName] = useState('');
    const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
    const originalGroupNameRef = useRef('');
    const originalGroupAvatarRef = useRef<string | null>(null);
    const [ownerId, setOwnerId] = useState('');
    const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Members Data
    const [members, setMembers] = useState<Member[]>([]);

    // Invite UI
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialView === 'invite') {
                setActiveTab('members');
                setShowInvite(true);
            } else if (initialView === 'settings') {
                setActiveTab('settings');
                setShowInvite(false);
            } else {
                setActiveTab('members'); // Default to members logic
                setShowInvite(false);
            }
        }
    }, [isOpen, initialView]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Fetch (when isOpen changes or groupId is available)
    const fetchData = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch group details
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();

            if (groupError) throw groupError;
            if (group) {
                setGroupName(group.name);
                setGroupAvatar(group.avatar_path);
                setOwnerId(group.owner_id);
                originalGroupNameRef.current = group.name || '';
                originalGroupAvatarRef.current = group.avatar_path || null;
            }

            // 2. Fetch members
            const { data: membersData, error: memberError } = await supabase
                .from('group_members')
                .select('user_id, role')
                .eq('group_id', groupId);

            if (memberError) throw memberError;

            if (membersData) {
                // Fetch profiles separately
                const userIds = membersData.map((m: any) => m.user_id);
                const { data: profiles, error: profError } = await supabase
                    .from('profiles')
                    .select('user_id, display_name, avatar_path, handle')
                    .in('user_id', userIds);

                if (profError) throw profError;

                const memberIds = membersData.map((m: any) => m.user_id);
                const nicknameMap = new Map<string, string>();

                const { data: requesterRows } = await supabase
                    .from('friendships')
                    .select('addressee_id, requester_nickname')
                    .eq('requester_id', userId)
                    .in('addressee_id', memberIds);

                const { data: addresseeRows } = await supabase
                    .from('friendships')
                    .select('requester_id, addressee_nickname')
                    .eq('addressee_id', userId)
                    .in('requester_id', memberIds);

                (requesterRows || []).forEach((row: any) => {
                    if (row.requester_nickname) {
                        nicknameMap.set(row.addressee_id, row.requester_nickname);
                    }
                });
                (addresseeRows || []).forEach((row: any) => {
                    if (row.addressee_nickname) {
                        nicknameMap.set(row.requester_id, row.addressee_nickname);
                    }
                });

                const membersWithProfiles = membersData.map((m: any) => {
                    const profile = profiles?.find((p: any) => p.user_id === m.user_id);
                    const customName = nicknameMap.get(m.user_id);
                    return {
                        user_id: m.user_id,
                        role: m.role,
                        display_name: customName || profile?.display_name || 'Unknown',
                        handle: profile?.handle || '',
                        avatar_path: profile?.avatar_path || null,
                    };
                });

                setMembers(membersWithProfiles);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [groupId, supabase]);

    // Fetch friends for invite
    const fetchFriends = useCallback(async () => {
        try {
            const { data: asRequester, error: requesterError } = await supabase
                .from('friendships')
                .select('requester_id, addressee_id')
                .eq('status', 'accepted')
                .eq('requester_id', userId);

            const { data: asAddressee, error: addresseeError } = await supabase
                .from('friendships')
                .select('requester_id, addressee_id')
                .eq('status', 'accepted')
                .eq('addressee_id', userId);

            if (requesterError || addresseeError) {
                throw requesterError || addresseeError;
            }

            const friendIdsSet = new Set<string>();

            (asRequester || []).forEach((row: any) => {
                if (row.addressee_id) friendIdsSet.add(row.addressee_id);
            });
            (asAddressee || []).forEach((row: any) => {
                if (row.requester_id) friendIdsSet.add(row.requester_id);
            });

            if (friendIdsSet.size === 0) {
                setFriends([]);
                return;
            }

            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_path, handle')
                .in('user_id', Array.from(friendIdsSet));

            if (profError) throw profError;

            if (profiles) {
                const filtered = profiles
                    .map((p: any) => ({
                        id: p.user_id,
                        displayName: p.display_name,
                        avatarPath: p.avatar_path,
                        handle: p.handle
                    }))
                    .filter((f: Friend) => !members.some(m => m.user_id === f.id));

                setFriends(filtered);
            } else {
                setFriends([]);
            }
        } catch (err) {
            console.error('Error fetching friends:', err);
            setFriends([]);
        }
    }, [supabase, userId, members]);

    useEffect(() => {
        if (isOpen && groupId) {
            fetchData();
        }
    }, [isOpen, groupId, fetchData]);

    useEffect(() => {
        if (showInvite) {
            fetchFriends();
        }
    }, [showInvite, members, fetchFriends]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setNewAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    type GroupLogEvent = {
        type: 'group_event';
        action: 'settings_updated' | 'member_added' | 'member_removed' | 'member_left';
        actorId: string;
        targetIds?: string[];
        targetId?: string;
        changes?: {
            name?: string;
            avatarUpdated?: boolean;
        };
    };

    const logGroupEvent = async (event: string | GroupLogEvent) => {
        const content = typeof event === 'string' ? event : JSON.stringify(event);
        try {
            await supabase.from('messages').insert({
                room_id: roomId,
                sender_user_id: userId,
                kind: 'system',
                content,
            } as any);
        } catch (err) {
            console.error('Failed to write group log:', err);
        }
    };

    const handleUpdateGroup = async () => {
        if (!groupId) return;
        const trimmedName = groupName.trim();
        if (!trimmedName) {
            setError('グループ名を入力してください');
            return;
        }
        if (ownerId !== userId) {
            setError('オーナーのみ設定を変更できます');
            return;
        }

        setUpdating(true);
        setError(null);
        try {
            let avatarPath = groupAvatar;

            if (newAvatarFile) {
                const ext = newAvatarFile.name.split('.').pop() || 'png';
                const fileName = `${userId}/group_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, newAvatarFile);
                if (uploadError) throw uploadError;
                avatarPath = fileName;
            }

            const nameChanged = trimmedName !== originalGroupNameRef.current;
            const avatarChanged = avatarPath !== originalGroupAvatarRef.current;
            if (!nameChanged && !avatarChanged) {
                setUpdating(false);
                return;
            }

            const { error: updateError } = await supabase
                .from('groups')
                .update({
                    name: trimmedName,
                    avatar_path: avatarPath,
                    updated_at: new Date().toISOString()
                })
                .eq('id', groupId)
                .eq('owner_id', userId);

            if (updateError) throw updateError;

            // Refresh
            setNewAvatarFile(null);
            setAvatarPreview(null);
            await fetchData();
            console.info('グループ設定を更新しました', {
                groupId,
                groupName: trimmedName,
                avatarPath,
            });
            await logGroupEvent({
                type: 'group_event',
                action: 'settings_updated',
                actorId: userId,
                changes: {
                    name: nameChanged ? trimmedName : undefined,
                    avatarUpdated: avatarChanged,
                },
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || '更新に失敗しました');
        } finally {
            setUpdating(false);
        }
    };

    const handleInviteMembers = async () => {
        if (!groupId || !roomId || selectedFriendIds.length === 0) return;
        setUpdating(true);

        try {
            await Promise.all(selectedFriendIds.map(async (fid) => {
                await supabase.from('group_members').insert({
                    group_id: groupId,
                    user_id: fid,
                    role: 'member'
                });
                await supabase.from('room_members').insert({
                    room_id: roomId,
                    user_id: fid
                });
            }));

            setShowInvite(false);
            setSelectedFriendIds([]);
            await fetchData();
            console.info('メンバーを招待しました', {
                groupId,
                invited: selectedFriendIds,
            });
            if (selectedFriendIds.length > 0) {
                await logGroupEvent({
                    type: 'group_event',
                    action: 'member_added',
                    actorId: userId,
                    targetIds: selectedFriendIds,
                });
            } else {
                await logGroupEvent({
                    type: 'group_event',
                    action: 'member_added',
                    actorId: userId,
                });
            }

        } catch (err: any) {
            console.error(err);
            setError('招待に失敗しました');
        } finally {
            setUpdating(false);
        }
    };

    const handleRemoveMember = async (targetId: string) => {
        if (!groupId || !confirm('このメンバーを削除しますか？')) return;

        try {
            await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId);
            await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', targetId);
            await fetchData();
            console.info('メンバーを削除しました', {
                groupId,
                userId: targetId,
            });
            if (targetId === userId) {
                await logGroupEvent({
                    type: 'group_event',
                    action: 'member_left',
                    actorId: userId,
                });
            } else {
                await logGroupEvent({
                    type: 'group_event',
                    action: 'member_removed',
                    actorId: userId,
                    targetId,
                });
            }
        } catch (err) {
            console.error(err);
            setError('削除に失敗しました');
        }
    };

    const filteredFriends = friends.filter(f =>
        f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.handle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const memberIds = useMemo(() => members.map(member => member.user_id), [members]);
    const profileWatchIds = useMemo(() => {
        const ids = new Set<string>(memberIds);
        if (ownerId) {
            ids.add(ownerId);
        }
        return Array.from(ids);
    }, [memberIds, ownerId]);

    useEffect(() => {
        if (!groupId || profileWatchIds.length === 0) return;

        const channel = supabase
            .channel(`group_profiles_${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                },
                (payload: any) => {
                    const updatedUserId = (payload.new || payload.old)?.user_id;
                    if (updatedUserId && profileWatchIds.includes(updatedUserId)) {
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, groupId, profileWatchIds, fetchData]);

    useEffect(() => {
        if (!groupId) return;

        const requesterChannel = supabase
            .channel(`group_friendships_requester_${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `requester_id=eq.${userId}`,
                },
                (payload: any) => {
                    const otherId = payload.new?.addressee_id || payload.old?.addressee_id;
                    if (!otherId) return;
                    if (memberIds.includes(otherId)) {
                        fetchData();
                    }
                }
            )
            .subscribe();

        const addresseeChannel = supabase
            .channel(`group_friendships_addressee_${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `addressee_id=eq.${userId}`,
                },
                (payload: any) => {
                    const otherId = payload.new?.requester_id || payload.old?.requester_id;
                    if (!otherId) return;
                    if (memberIds.includes(otherId)) {
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(requesterChannel);
            supabase.removeChannel(addresseeChannel);
        };
    }, [supabase, groupId, userId, memberIds, fetchData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="card w-full max-w-lg h-[80vh] flex flex-col bg-white dark:bg-surface-900 animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">グループ設定</h3>
                    <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-surface-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-surface-200 dark:border-surface-700">
                    <button
                        onClick={() => { setActiveTab('members'); setShowInvite(false); }}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'members' && !showInvite ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'}`}
                    >
                        <UserGroupIcon className="w-4 h-4" />
                        メンバー
                    </button>
                    {(userId === ownerId || true) && (
                        // Settings visible to everyone? Or Owner only? 
                        // Group name viewable by everyone. Edit by owner only.
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'}`}
                        >
                            <Cog6ToothIcon className="w-4 h-4" />
                            設定
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-8 text-surface-500">読み込み中...</div>
                    ) : (
                        <>
                            {activeTab === 'members' && (
                                <>
                                    {!showInvite ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-medium text-surface-700 dark:text-surface-300">メンバー ({members.length})</h4>
                                                {/* Allow anyone or owner to invite? Usually anyone in casual groups */}
                                                <button
                                                    onClick={() => setShowInvite(true)}
                                                    className="btn-secondary text-xs py-1.5 px-3"
                                                >
                                                    <UserPlusIcon className="w-4 h-4 mr-1" />
                                                    招待
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {members.map(member => (
                                                    <div
                                                        key={member.user_id}
                                                        className="flex items-center gap-3 py-1.5"
                                                    >
                                                        <div
                                                            className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold ring-1 ring-surface-200 dark:ring-surface-700 ${member.avatar_path
                                                                ? 'bg-surface-200 dark:bg-surface-700'
                                                                : 'bg-gradient-to-br from-primary-400 to-accent-400 text-white'
                                                                }`}
                                                        >
                                                            {member.avatar_path ? (
                                                                <Image
                                                                    src={getStorageUrl('avatars', member.avatar_path)}
                                                                    alt={member.display_name}
                                                                    width={40}
                                                                    height={40}
                                                                    className="object-cover w-full h-full"
                                                                />
                                                            ) : (
                                                                <span>{getInitials(member.display_name)}</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-sm truncate">{member.display_name}</p>
                                                                {member.role === 'owner' && (
                                                                    <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 rounded-full dark:bg-primary-900/30 dark:text-primary-400">
                                                                        オーナー
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-surface-500">@{member.handle || 'unknown'}</p>
                                                        </div>
                                                        {userId === ownerId && member.user_id !== userId && (
                                                            <button
                                                                onClick={() => handleRemoveMember(member.user_id)}
                                                                className="ml-auto text-xs text-error-500 hover:text-error-600 hover:underline"
                                                            >
                                                                削除
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="flex items-center gap-2 mb-4">
                                                <button onClick={() => setShowInvite(false)} className="text-sm text-surface-500 hover:text-surface-700">
                                                    ← 戻る
                                                </button>
                                                <h4 className="font-medium">友達を招待</h4>
                                            </div>

                                            <div className="relative mb-2">
                                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                                <input
                                                    type="text"
                                                    placeholder="検索..."
                                                    className="input pl-9 py-1.5 text-sm"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            <div className="border border-surface-200 dark:border-surface-700 rounded-lg max-h-64 overflow-y-auto p-1">
                                                {filteredFriends.length > 0 ? filteredFriends.map(friend => {
                                                    const isSelected = selectedFriendIds.includes(friend.id);
                                                    return (
                                                        <div
                                                            key={friend.id}
                                                            onClick={() => setSelectedFriendIds(prev => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
                                                            className={`flex items-center gap-3 p-2 rounded cursor-pointer ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                                                        >
                                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-200">
                                                                {friend.avatarPath ? (
                                                                    <Image src={getStorageUrl('avatars', friend.avatarPath)} alt="" width={32} height={32} className="object-cover w-full h-full" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                                                        {getInitials(friend.displayName)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium">{friend.displayName}</p>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-surface-300'}`}>
                                                                {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="p-4 text-center text-sm text-surface-500">友達が見つかりません</div>
                                                )}
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={handleInviteMembers}
                                                    disabled={selectedFriendIds.length === 0 || updating}
                                                    className="btn-primary"
                                                >
                                                    {updating ? '招待中...' : '招待する'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'settings' && (
                                <div className="space-y-6">
                                    {/* Icon */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">グループアイコン</label>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-20 h-20 rounded-full overflow-hidden bg-surface-100 relative group ${userId === ownerId ? 'cursor-pointer border-2 border-dashed border-surface-300 hover:border-primary-500' : ''}`} onClick={() => userId === ownerId && fileInputRef.current?.click()}>
                                                {avatarPreview || groupAvatar ? (
                                                    <Image src={avatarPreview || getStorageUrl('avatars', groupAvatar!)} alt="" fill className="object-cover" />
                                                ) : (
                                                    <PhotoIcon className="w-8 h-8 text-surface-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                                )}
                                                {userId === ownerId && (
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <PencilIcon className="w-6 h-6 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                {userId === ownerId && (
                                                    <div className="text-sm text-surface-500">
                                                        <p>クリックして変更</p>
                                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">グループ名</label>
                                        <input
                                            type="text"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            disabled={userId !== ownerId}
                                            className="input w-full"
                                        />
                                    </div>

                                    {userId === ownerId && (
                                        <div className="pt-4 border-t border-surface-200 dark:border-surface-700 flex justify-end">
                                            <button
                                                onClick={handleUpdateGroup}
                                                disabled={updating}
                                                className="btn-primary"
                                            >
                                                {updating ? '更新中...' : '変更を保存'}
                                            </button>
                                        </div>
                                    )}

                                    {error && <div className="text-error-500 text-sm mt-2">{error}</div>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
