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

interface Friend {
    id: string;
    user_id: string;
    display_name: string;
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

export function FriendsList({ userId }: FriendsListProps) {
    const supabase = useMemo(() => createClient(), []);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<{ user_id: string; display_name: string; handle: string; avatar_path: string | null } | null>(null);
    const [searchRelation, setSearchRelation] = useState<FriendshipRelation | null>(null);
    const [activeIncomingId, setActiveIncomingId] = useState<string | null>(null);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFriends = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data: asRequester, error: requesterError } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id')
            .eq('requester_id', userId);

        const { data: asAddressee, error: addresseeError } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id')
            .eq('addressee_id', userId);

        if (requesterError || addresseeError) {
            setError('友達情報の取得に失敗しました');
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
                setError('友達情報の取得に失敗しました');
                setLoading(false);
                return;
            }

            profilesById = (profiles || []).reduce((acc, profile) => {
                acc[profile.user_id] = profile;
                return acc;
            }, {} as Record<string, { user_id: string; display_name: string; handle: string; avatar_path: string | null }>);
        }

        const acceptedById = new Map<string, Friend>();
        const pendingById = new Map<string, Friend>();

        const addRow = (row: any, profile: any, isRequester: boolean) => {
            if (!profile) return;

            const friend: Friend = {
                id: row.id,
                user_id: profile.user_id,
                display_name: profile.display_name,
                handle: profile.handle,
                avatar_path: profile.avatar_path,
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
        setSearchRelation((relation as FriendshipRelation) || null);
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

        if (!reverseError && reverseRequest?.id && reverseRequest.status === 'pending') {
            const { error: acceptError } = await (supabase
                .from('friendships') as any)
                .update({ status: 'accepted' })
                .eq('id', reverseRequest.id);

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
    };

    const incomingRequests = useMemo(
        () => pendingRequests.filter((friend) => !friend.is_requester),
        [pendingRequests]
    );

    const outgoingRequests = useMemo(
        () => pendingRequests.filter((friend) => friend.is_requester),
        [pendingRequests]
    );

    // Start DM
    const handleStartChat = async (friendUserId: string) => {
        // Check if DM room exists
        const { data: existingRooms } = await supabase
            .from('room_members')
            .select('room_id, rooms!inner(type)')
            .eq('user_id', userId);

        const { data: friendRooms } = await supabase
            .from('room_members')
            .select('room_id')
            .eq('user_id', friendUserId);

        const myRoomIds = existingRooms?.filter((r: any) => r.rooms.type === 'dm').map((r: any) => r.room_id) || [];
        const friendRoomIds = friendRooms?.map((r: any) => r.room_id) || [];
        const commonRoom = myRoomIds.find((id: string) => friendRoomIds.includes(id));

        if (commonRoom) {
            window.location.href = `/talk/${commonRoom}`;
            return;
        }

        // Create new DM room
        const { data: newRoom, error: roomError } = await supabase
            .from('rooms')
            .insert({ type: 'dm' } as any)
            .select()
            .single();

        if (roomError || !newRoom) {
            setError('ルームの作成に失敗しました');
            return;
        }

        // Add self first (RLS), then friend
        const { error: selfJoinError } = await supabase.from('room_members').insert([
            { room_id: (newRoom as any).id, user_id: userId },
        ] as any);

        if (selfJoinError) {
            setError('ルームへの参加に失敗しました');
            return;
        }

        const { error: friendJoinError } = await supabase.from('room_members').insert([
            { room_id: (newRoom as any).id, user_id: friendUserId },
        ] as any);

        if (friendJoinError) {
            setError('相手の追加に失敗しました');
            return;
        }

        window.location.href = `/talk/${(newRoom as any).id}`;
    };

    const searchIsFriend = searchRelation?.status === 'accepted';
    const searchIncoming = searchRelation?.status === 'pending' && searchRelation.addressee_id === userId;
    const searchOutgoing = searchRelation?.status === 'pending' && searchRelation.requester_id === userId;

    if (loading) {
        return <div className="text-center py-8 text-surface-400">読み込み中...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Search / Add Friend */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="@ユーザーIDで検索"
                    className="input flex-1 text-sm"
                />
                <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="btn-primary"
                >
                    {searching ? '...' : <UserPlusIcon className="w-5 h-5" />}
                </button>
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
                        {searchResult.avatar_path ? (
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
                                    {friend.avatar_path ? (
                                        <Image
                                            src={getStorageUrl('avatars', friend.avatar_path)}
                                            alt={friend.display_name}
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-white text-sm font-bold">{getInitials(friend.display_name)}</span>
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
                                {friend.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', friend.avatar_path)}
                                        alt={friend.display_name}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white text-sm font-bold">{getInitials(friend.display_name)}</span>
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
                        <div key={friend.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                {friend.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', friend.avatar_path)}
                                        alt={friend.display_name}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white text-sm font-bold">{getInitials(friend.display_name)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{friend.display_name}</p>
                                <p className="text-xs text-surface-500">@{friend.handle}</p>
                            </div>
                            <button
                                onClick={() => handleStartChat(friend.user_id)}
                                className="btn-icon p-1.5"
                            >
                                <ChatBubbleIcon className="w-5 h-5" />
                            </button>
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
        </div>
    );
}
