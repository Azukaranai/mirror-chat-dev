'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useChatStore } from '@/lib/stores';
import { getStorageUrl, getInitials, formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Room {
    id: string;
    type: 'dm' | 'group';
    name: string;
    avatar_path: string | null;
    handle?: string | null;
    last_message?: string;
    last_message_at?: string;
    unread_count: number;
}

interface RoomListProps {
    userId: string;
    activeRoomId?: string;
}

export function RoomList({ userId, activeRoomId }: RoomListProps) {
    const router = useRouter();
    const [supabase, setSupabase] = useState<any>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenuRoomId, setContextMenuRoomId] = useState<string | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    // Global message search
    const [messageSearchResults, setMessageSearchResults] = useState<Array<{
        id: string;
        content: string;
        room_id: string;
        room_name: string;
        sender_name: string;
        sender_avatar_path: string | null;
        created_at: string;
    }>>([]);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);

    // Initialize Supabase client on mount
    useEffect(() => {
        setSupabase(getSupabaseClient());
    }, []);

    // Hide room
    const handleHideRoom = async (roomId: string) => {
        if (!supabase) return;

        await (supabase
            .from('room_members') as any)
            .update({ hidden_at: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', userId);

        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setContextMenuRoomId(null);

        if (activeRoomId === roomId) {
            router.push('/talk');
        }
    };

    // Leave/Delete room
    const handleLeaveRoom = async (roomId: string, roomType: 'dm' | 'group') => {
        if (!supabase) return;

        if (roomType === 'dm') {
            await handleHideRoom(roomId);
        } else {
            await (supabase
                .from('room_members') as any)
                .delete()
                .eq('room_id', roomId)
                .eq('user_id', userId);

            setRooms((prev) => prev.filter((r) => r.id !== roomId));
            setContextMenuRoomId(null);

            if (activeRoomId === roomId) {
                router.push('/talk');
            }
        }
    };

    // Handle right-click context menu
    const handleContextMenu = (e: React.MouseEvent, roomId: string) => {
        e.preventDefault();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuRoomId(roomId);
    };

    // Fetch rooms
    useEffect(() => {
        if (!supabase) return;

        const fetchRooms = async (showLoading = false) => {
            if (showLoading) {
                setLoading(true);
            }

            const { data: summaries } = await supabase
                .from('room_summaries')
                .select(`
          room_id,
          room_type,
          room_name,
          room_avatar_path,
          room_handle,
          last_message_content,
          last_message_kind,
          last_message_at,
          unread_count
        `)
                .eq('user_id', userId);

            if (!summaries) {
                setLoading(false);
                return;
            }

            const roomList: Room[] = (summaries as any[]).map((summary) => {
                let lastMessageContent = summary.last_message_content || '';
                if (summary.last_message_kind === 'shared_ai_thread') {
                    lastMessageContent = '🤖 AIスレッドを共有しました';
                } else if (summary.last_message_kind === 'attachment') {
                    lastMessageContent = '📎 添付ファイル';
                }

                return {
                    id: summary.room_id,
                    type: summary.room_type,
                    name: summary.room_name || 'Unknown',
                    avatar_path: summary.room_avatar_path || null,
                    handle: summary.room_handle || null,
                    last_message: lastMessageContent,
                    last_message_at: summary.last_message_at,
                    unread_count: summary.unread_count || 0,
                };
            });

            // Sort by last message time
            roomList.sort((a, b) => {
                if (!a.last_message_at) return 1;
                if (!b.last_message_at) return -1;
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
            });

            setRooms(roomList);
            setLoading(false);
        };

        fetchRooms(true);

        // Subscribe to new messages
        const channel = supabase
            .channel('room_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload: any) => {
                    // Emit signal to notify ChatRoom about the new message
                    const newMsg = payload.new as any;
                    if (newMsg?.room_id && newMsg?.id) {
                        useChatStore.getState().emitNewMessage(newMsg.room_id, newMsg.id);
                    }
                    fetchRooms(false);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_members',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    fetchRooms(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, userId]);

    const filteredRooms = rooms.filter((room) =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Global message search
    useEffect(() => {
        if (!supabase || searchQuery.length < 2) {
            setMessageSearchResults([]);
            return;
        }

        const searchMessages = async () => {
            setIsSearchingMessages(true);
            try {
                // Search messages where user is a member of the room
                const { data: myRooms } = await supabase
                    .from('room_members')
                    .select('room_id')
                    .eq('user_id', userId);

                if (!myRooms || myRooms.length === 0) {
                    setMessageSearchResults([]);
                    setIsSearchingMessages(false);
                    return;
                }

                const roomIds = myRooms.map((r: any) => r.room_id);

                const { data: messages } = await supabase
                    .from('messages')
                    .select('id, content, room_id, sender_user_id, created_at')
                    .in('room_id', roomIds)
                    .eq('kind', 'text')
                    .ilike('content', `%${searchQuery}%`)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (!messages || messages.length === 0) {
                    setMessageSearchResults([]);
                    setIsSearchingMessages(false);
                    return;
                }

                // Get room names and sender names
                const uniqueRoomIds = Array.from(new Set(messages.map((m: any) => m.room_id)));
                const uniqueSenderIds = Array.from(new Set(messages.map((m: any) => m.sender_user_id)));

                const [roomsData, profilesData] = await Promise.all([
                    supabase.from('room_summaries').select('room_id, room_name').in('room_id', uniqueRoomIds).eq('user_id', userId),
                    supabase.from('profiles').select('user_id, display_name, avatar_path').in('user_id', uniqueSenderIds)
                ]);

                const roomMap = new Map((roomsData.data || []).map((r: any) => [r.room_id, r.room_name]));
                const profileMap = new Map((profilesData.data || []).map((p: any) => [p.user_id, { name: p.display_name, avatar: p.avatar_path }]));

                const results = messages.map((m: any) => {
                    const profile = (profileMap.get(m.sender_user_id) as { name: string; avatar: string | null } | undefined) || { name: 'Unknown', avatar: null };
                    return {
                        id: m.id,
                        content: m.content,
                        room_id: m.room_id,
                        room_name: roomMap.get(m.room_id) || 'Unknown',
                        sender_name: profile.name || 'Unknown',
                        sender_avatar_path: profile.avatar || null,
                        created_at: m.created_at,
                    };
                });

                setMessageSearchResults(results);
            } catch (e) {
                console.error('Message search error:', e);
                setMessageSearchResults([]);
            }
            setIsSearchingMessages(false);
        };

        const debounce = setTimeout(searchMessages, 300);
        return () => clearTimeout(debounce);
    }, [supabase, searchQuery, userId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto flex flex-col">
            {/* Search */}
            <div className="p-3">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="トークを検索..."
                    className="w-full text-sm py-2 px-4 rounded-full bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-surface-900 focus:ring-2 focus:ring-primary-500/20 placeholder:text-surface-400 transition-all outline-none"
                />
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-auto px-2">
                {/* Message Search Results */}
                {searchQuery.length >= 2 && (
                    <div className="mb-4">
                        <p className="text-xs font-medium text-surface-500 px-2 py-2 uppercase tracking-wider">
                            メッセージ検索結果
                            {isSearchingMessages && <span className="ml-2 text-primary-500">検索中...</span>}
                        </p>
                        {messageSearchResults.length > 0 ? (
                            messageSearchResults.map((result) => (
                                <Link
                                    key={result.id}
                                    href={`/talk/${result.room_id}?highlight=${result.id}`}
                                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                        {result.sender_avatar_path ? (
                                            <Image
                                                src={getStorageUrl('avatars', result.sender_avatar_path)}
                                                alt={result.sender_name}
                                                width={40}
                                                height={40}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white font-bold text-sm">{getInitials(result.sender_name)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{result.sender_name}</span>
                                            <span className="text-xs text-surface-400">•</span>
                                            <span className="text-xs text-primary-600 dark:text-primary-400">{result.room_name}</span>
                                        </div>
                                        <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mt-0.5">
                                            {result.content?.length > 100 ? result.content.substring(0, 100) + '...' : result.content}
                                        </p>
                                    </div>
                                </Link>
                            ))
                        ) : !isSearchingMessages ? (
                            <p className="text-sm text-surface-400 px-2 py-4">メッセージが見つかりません</p>
                        ) : null}
                    </div>
                )}

                {/* Rooms */}
                <p className="text-xs font-medium text-surface-500 px-2 py-2 uppercase tracking-wider">トーク一覧</p>
                {filteredRooms.length > 0 ? (
                    filteredRooms.map((room) => (
                        <Link
                            key={room.id}
                            href={`/talk/${room.id}`}
                            onContextMenu={(e) => handleContextMenu(e, room.id)}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors',
                                activeRoomId === room.id && 'bg-surface-100 dark:bg-surface-800'
                            )}
                        >
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                                {room.handle === 'mirror' || room.name === 'Mirror' ? (
                                    <Image
                                        src="/app-icon.svg"
                                        alt="Mirror"
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover bg-white"
                                    />
                                ) : room.avatar_path ? (
                                    <Image
                                        src={getStorageUrl('avatars', room.avatar_path)}
                                        alt={room.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white font-bold">{getInitials(room.name)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium truncate">{room.name}</p>
                                    {room.last_message_at && (
                                        <span className="text-xs text-surface-400 flex-shrink-0 ml-2">
                                            {formatRelativeTime(room.last_message_at)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-surface-500 truncate">
                                        {room.last_message || 'メッセージはありません'}
                                    </p>
                                    {room.unread_count > 0 && activeRoomId !== room.id && (
                                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-primary-500 text-white rounded-full flex-shrink-0">
                                            {room.unread_count > 99 ? '99+' : room.unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="text-center py-12 text-surface-400">
                        <p>トークがありません</p>
                        <p className="text-sm mt-1">友達を追加してトークを始めましょう</p>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenuRoomId && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenuRoomId(null)} />
                    <div
                        className="fixed z-50 w-44 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
                    >
                        <button
                            onClick={() => handleHideRoom(contextMenuRoomId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-left"
                        >
                            <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                            <span className="text-sm">非表示</span>
                        </button>
                        <button
                            onClick={() => {
                                const room = rooms.find(r => r.id === contextMenuRoomId);
                                if (room) handleLeaveRoom(contextMenuRoomId, room.type);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors text-left text-error-600 dark:text-error-400"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            <span className="text-sm">
                                {rooms.find(r => r.id === contextMenuRoomId)?.type === 'dm' ? '削除' : '退出'}
                            </span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

