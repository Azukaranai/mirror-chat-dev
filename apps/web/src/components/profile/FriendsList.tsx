'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getStorageUrl, getInitials } from '@/lib/utils';
 

const UserPlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const ChatBubbleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

interface Friend {
    id: string;
    user_id: string;
    display_name: string;
    nickname: string | null;
    handle: string;
    avatar_path: string | null;
    status: 'pending' | 'accepted';
    is_requester: boolean;
}

interface FriendshipRelation {
    id: string;
    status: 'pending' | 'accepted';
    requester_id: string;
    addressee_id: string;
}

interface FriendsListProps {
    userId: string;
}

import { useChatStore } from '@/lib/stores';
import { EditNicknameDialog } from './EditNicknameDialog';

export function FriendsList({ userId }: FriendsListProps) {
    const supabase = useMemo(() => createClient(), []);
    const { fetchNotifications } = useChatStore();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<{ user_id: string; display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [searchRelation, setSearchRelation] = useState<FriendshipRelation | null>(null);
    const [activeIncomingId, setActiveIncomingId] = useState<string | null>(null);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Nickname editing state
    const [editingFriend, setEditingFriend] = useState<Friend | null>(null);

    const fetchFriends = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data: asRequester, error: requesterError } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id, requester_nickname, addressee_nickname')
            .eq('requester_id', userId);

        const { data: asAddressee, error: addresseeError } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id, requester_nickname, addressee_nickname')
            .eq('addressee_id', userId);

        if (requesterError || addresseeError) {
            console.error('Friendships fetch error:', requesterError || addresseeError);
            setError(`友達情報の取得に失敗しました: ${(requesterError || addresseeError)?.message || '不明なエラー'}`);
            setLoading(false);
            return;
        }

        const friendIds = new Set<string>();
        asRequester?.forEach((row: any) => friendIds.add(row.addressee_id));
        asAddressee?.forEach((row: any) => friendIds.add(row.requester_id));

        let profilesById: Record<string, { user_id: string; display_name: string; handle: string; avatar_path: string | null }> = {};

        if (friendIds.size > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('user_id, display_name, handle, avatar_path')
                .in('user_id', Array.from(friendIds));

            if (profilesError) {
                console.error('Profiles fetch error:', profilesError);
                setError(`友達情報の取得に失敗しました: ${profilesError?.message || '不明なエラー'}`);
                setLoading(false);
                return;
            }

            profilesById = (profiles || []).reduce((acc, profile: any) => {
                acc[profile.user_id] = profile;
                return acc;
            }, {} as Record<string, { user_id: string; display_name: string; handle: string; avatar_path: string | null }>);
        }

        const acceptedById = new Map<string, Friend>();
        const pendingById = new Map<string, Friend>();

        const addRow = (row: any, profile: any, isRequester: boolean) => {
            // Fallback for missing profile (e.g. deleted user)
            const displayProfile = profile || {
                user_id: isRequester ? row.addressee_id : row.requester_id,
                display_name: '不明なユーザー',
                handle: 'unknown',
                avatar_path: null
            };

            // Determine which nickname to use
            // If I am requester, I see requester_nickname (which I set for addressee)
            // If I am addressee, I see addressee_nickname (which I set for requester)
            const nickname = isRequester ? row.requester_nickname : row.addressee_nickname;

            const friend: Friend = {
                id: row.id,
                user_id: displayProfile.user_id,
                display_name: displayProfile.display_name,
                nickname: nickname,
                handle: displayProfile.handle,
                avatar_path: displayProfile.avatar_path,
                status: row.status,
                is_requester: isRequester,
            };

            if (row.status === 'accepted') {
                acceptedById.set(friend.user_id, friend);
                pendingById.delete(friend.user_id);
                return;
            }

            if (row.status === 'pending' && !acceptedById.has(friend.user_id)) {
                const existing = pendingById.get(friend.user_id);
                if (!existing) {
                    pendingById.set(friend.user_id, friend);
                } else if (existing.is_requester && !friend.is_requester) {
                    // Prefer incoming request when both directions are pending.
                    pendingById.set(friend.user_id, friend);
                }
            }
        };

        asRequester?.forEach((row: any) => {
            addRow(row, profilesById[row.addressee_id], true);
        });

        asAddressee?.forEach((row: any) => {
            addRow(row, profilesById[row.requester_id], false);
        });

        console.log('[DEBUG] Fetched accepted:', acceptedById.size);
        console.log('[DEBUG] Fetched pending:', pendingById.size);
        console.log('[DEBUG] Raw requests count (asAddressee):', asAddressee?.length);

        setFriends(Array.from(acceptedById.values()));
        setPendingRequests(Array.from(pendingById.values()));
        setLoading(false);
    }, [supabase, userId]);

    // Fetch friends on mount
    useEffect(() => {
        fetchFriends();
    }, [fetchFriends]);

    // Realtime updates for incoming/outgoing requests
    useEffect(() => {
        const channel = supabase
            .channel(`friendships:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `requester_id=eq.${userId}`,
                },
                () => {
                    fetchFriends();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `addressee_id=eq.${userId}`,
                },
                () => {
                    fetchFriends();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchFriends, supabase, userId]);

    // Search user by handle
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        setSearchResult(null);
        setSearchRelation(null);
        setError(null);

        const handle = searchQuery.trim().replace('@', '').toLowerCase();

        const { data: profiles, error: searchError } = await supabase
            .from('profiles')
            .select('user_id, display_name, handle, avatar_path')
            .eq('handle', handle)
            .neq('user_id', userId);

        const data = profiles && profiles.length > 0 ? (profiles[0] as any) : null;

        if (searchError || !data) {
            setError('ユーザーが見つかりません');
            setSearching(false);
            return;
        }

        const localMatch = [...friends, ...pendingRequests].find((friend) => friend.user_id === data.user_id);
        if (localMatch) {
            const relation: FriendshipRelation = {
                id: localMatch.id,
                status: localMatch.status,
                requester_id: localMatch.is_requester ? userId : data.user_id,
                addressee_id: localMatch.is_requester ? data.user_id : userId,
            };
            setSearchResult(data);
            setSearchRelation(relation);
            setSearching(false);
            return;
        }

        const { data: relations, error: relationError } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id')
            .or(`and(requester_id.eq.${userId},addressee_id.eq.${data.user_id}),and(requester_id.eq.${data.user_id},addressee_id.eq.${userId})`);

        if (relationError) {
            setError('友達情報の取得に失敗しました');
            setSearchResult(data);
            setSearching(false);
            return;
        }

        const relation = (relations || []).find((row: any) => row.status === 'accepted')
            || (relations && relations.length > 0 ? relations[0] : null);

        setSearchResult(data);
        setSearchRelation((relation as unknown as FriendshipRelation) || null);
        setSearching(false);
    };

    // Send friend request
    const handleSendRequest = async () => {
        if (!searchResult || searchRelation) return;

        setError(null);

        const { data: reverseRequest, error: reverseError } = await supabase
            .from('friendships')
            .select('id, status')
            .eq('requester_id', searchResult.user_id)
            .eq('addressee_id', userId)
            .maybeSingle();

        if (!reverseError && (reverseRequest as any)?.id && (reverseRequest as any).status === 'pending') {
            const { error: acceptError } = await (supabase
                .from('friendships') as any)
                .update({ status: 'accepted' })
                .eq('id', (reverseRequest as any).id);

            if (acceptError) {
                setError('申請の承認に失敗しました');
                return;
            }

            await fetchFriends();
            setSearchResult(null);
            setSearchQuery('');
            return;
        }

        const { error: insertError } = await (supabase
            .from('friendships') as any)
            .insert({
                requester_id: userId,
                addressee_id: searchResult.user_id,
                status: 'pending',
            });

        if (insertError) {
            if (insertError.code === '23505') {
                setError('既に申請済みです');
                await fetchFriends();
                setSearchResult(null);
                setSearchRelation(null);
                setSearchQuery('');
                return;
            }
            setError('申請に失敗しました');
            return;
        }

        await fetchFriends();
        setSearchResult(null);
        setSearchRelation(null);
        setSearchQuery('');
    };

    // Accept friend request
    const handleAccept = async (friendshipId: string) => {
        const { error: updateError } = await (supabase
            .from('friendships') as any)
            .update({ status: 'accepted' })
            .eq('id', friendshipId);

        if (updateError) {
            setError('申請の承認に失敗しました');
            return;
        }

        await fetchFriends();
        fetchNotifications();
    };

    // Reject/Cancel friend request
    const handleReject = async (friendshipId: string) => {
        const { error: deleteError } = await (supabase
            .from('friendships') as any)
            .delete()
            .eq('id', friendshipId);

        if (deleteError) {
            setError('申請の拒否に失敗しました');
            return;
        }

        await fetchFriends();
        fetchNotifications();
    };

    // Start DM
    const handleStartChat = async (friendUserId: string) => {
        const { data: roomId, error } = await (supabase.rpc as any)('create_dm_room', {
            friend_id: friendUserId,
        });

        if (error) {
            console.error('Failed to create DM room:', error);
            setError('トークルームの作成に失敗しました');
            return;
        }

        // Go to chat
        window.location.href = `/talk/${roomId}`;
    };

    const handleSaveNickname = async (newName: string) => {
        if (!editingFriend) return;

        // If I am requester, I update requester_nickname
        // If I am addressee, I update addressee_nickname
        const updateData = editingFriend.is_requester
            ? { requester_nickname: newName }
            : { addressee_nickname: newName };

        const { error } = await (supabase
            .from('friendships') as any)
            .update(updateData)
            .eq('id', editingFriend.id);

        if (error) {
            setError('表示名の更新に失敗しました');
        } else {
            await fetchFriends();
            setEditingFriend(null);
        }
    };

    const incomingRequests = useMemo(
        () => pendingRequests.filter((friend) => !friend.is_requester),
        [pendingRequests]
    );

    const outgoingRequests = useMemo(
        () => pendingRequests.filter((friend) => friend.is_requester),
        [pendingRequests]
    );

    const searchIsFriend = searchRelation?.status === 'accepted';
    const searchIncoming = searchRelation?.status === 'pending' && searchRelation.addressee_id === userId;
    const searchOutgoing = searchRelation?.status === 'pending' && searchRelation.requester_id === userId;

    if (loading) {
        return <div className="text-center py-8 text-surface-400">読み込み中...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Friends header */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold">友達</h2>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="@ユーザーIDで検索"
                            className="w-full text-sm py-2.5 pl-9 pr-4 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 placeholder:text-surface-400 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searching || !searchQuery.trim()}
                        className="px-4 rounded-2xl bg-primary-500 text-white text-sm font-medium shadow-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {searching ? '...' : '追加'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-2 rounded bg-error-500/10 text-error-600 dark:text-error-400 text-sm">
                    {error}
                </div>
            )}

            {/* Search Result */}
            {searchResult && (
                <div className="p-3 rounded-lg bg-primary-500/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                        {searchResult.handle === 'mirror' ? (
                            <Image
                                src="/app-icon.svg"
                                alt="Mirror"
                                width={40}
                                height={40}
                                className="w-full h-full object-cover bg-white"
                            />
                        ) : searchResult.avatar_path ? (
                            <Image
                                src={getStorageUrl('avatars', searchResult.avatar_path)}
                                alt={searchResult.display_name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-white text-sm font-bold">{getInitials(searchResult.display_name)}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{searchResult.display_name}</p>
                        <p className="text-xs text-surface-500">@{searchResult.handle}</p>
                    </div>
                    {searchIsFriend ? (
                        <button
                            onClick={() => handleStartChat(searchResult.user_id)}
                            className="btn-secondary text-sm"
                        >
                            トーク
                        </button>
                    ) : searchIncoming ? (
                        <div className="flex gap-1">
                            <button
                                onClick={() => {
                                    handleAccept(searchRelation!.id);
                                    setSearchResult(null);
                                    setSearchRelation(null);
                                    setSearchQuery('');
                                }}
                                className="btn-primary text-sm"
                            >
                                承認
                            </button>
                            <button
                                onClick={() => {
                                    handleReject(searchRelation!.id);
                                    setSearchResult(null);
                                    setSearchRelation(null);
                                    setSearchQuery('');
                                }}
                                className="btn-secondary text-sm"
                            >
                                拒否
                            </button>
                        </div>
                    ) : searchOutgoing ? (
                        <span className="text-xs text-surface-500">申請中</span>
                    ) : (
                        <button onClick={handleSendRequest} className="btn-primary text-sm">
                            申請
                        </button>
                    )}
                </div>
            )}

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-surface-500">申請が届いています</h3>
                    {incomingRequests.map((friend) => {
                        const isActive = activeIncomingId === friend.id;
                        return (
                            <div
                                key={friend.id}
                                onClick={() => setActiveIncomingId(isActive ? null : friend.id)}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
                            >
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                    {friend.handle === 'mirror' ? (
                                        <Image
                                            src="/app-icon.svg"
                                            alt="Mirror"
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover bg-white"
                                        />
                                    ) : friend.avatar_path ? (
                                        <Image
                                            src={getStorageUrl('avatars', friend.avatar_path)}
                                            alt={friend.display_name}
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-white text-sm font-bold">{getInitials(friend.nickname || friend.display_name)}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{friend.display_name}</p>
                                    <p className="text-xs text-surface-500">@{friend.handle}</p>
                                </div>
                                {isActive ? (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleAccept(friend.id);
                                                setActiveIncomingId(null);
                                            }}
                                            className="btn-icon p-1.5 text-success-500"
                                        >
                                            <CheckIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleReject(friend.id);
                                                setActiveIncomingId(null);
                                            }}
                                            className="btn-icon p-1.5 text-error-500"
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xs text-surface-400">タップして承認</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Outgoing Requests */}
            {outgoingRequests.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-surface-500">申請中</h3>
                    {outgoingRequests.map((friend) => (
                        <div key={friend.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                {friend.handle === 'mirror' ? (
                                    <Image
                                        src="/app-icon.svg"
                                        alt="Mirror"
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover bg-white"
                                    />
                                ) : friend.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', friend.avatar_path)}
                                        alt={friend.display_name}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white text-sm font-bold">{getInitials(friend.nickname || friend.display_name)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{friend.display_name}</p>
                                <p className="text-xs text-surface-500">@{friend.handle}</p>
                            </div>
                            <span className="text-xs text-surface-400">申請中</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Friends List */}
            {friends.length > 0 ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                            <h3 className="text-sm font-medium text-surface-500">友達</h3>
                        )}
                        {incomingRequests.length > 0 && (
                            <span className="text-xs rounded-full bg-primary-500/10 text-primary-600 px-2 py-0.5">
                                受信 {incomingRequests.length}
                            </span>
                        )}
                    </div>
                    {friends.map((friend) => (
                        <div key={friend.id} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                {friend.handle === 'mirror' ? (
                                    <Image
                                        src="/app-icon.svg"
                                        alt="Mirror"
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover bg-white"
                                    />
                                ) : friend.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', friend.avatar_path)}
                                        alt={friend.display_name}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white text-sm font-bold">{getInitials(friend.nickname || friend.display_name)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">
                                        {friend.nickname || friend.display_name}
                                    </p>
                                    {friend.nickname && (
                                        <p className="text-xs text-surface-400 truncate hidden md:block">
                                            ({friend.display_name})
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs text-surface-500">@{friend.handle}</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center">
                                <button
                                    onClick={() => setEditingFriend(friend)}
                                    className="btn-icon p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="表示名を変更"
                                >
                                    <PencilIcon className="w-4 h-4 text-surface-400" />
                                </button>
                                <button
                                    onClick={() => handleStartChat(friend.user_id)}
                                    className="btn-icon p-1.5 ml-1"
                                    title="トーク"
                                >
                                    <ChatBubbleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                    <div className="text-center py-8 text-surface-400">
                        <p>友達がいません</p>
                        <p className="text-sm mt-1">IDを検索して友達を追加しましょう</p>
                    </div>
                )
            )}

            {/* Edit Nickname Modal */}
            <EditNicknameDialog
                isOpen={!!editingFriend}
                onClose={() => setEditingFriend(null)}
                currentName={editingFriend?.nickname || editingFriend?.display_name || ''}
                onSave={handleSaveNickname}
            />
        </div>
    );
}
