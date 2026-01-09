'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
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
    const supabase = useMemo(() => createClient(), []);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch rooms
    useEffect(() => {
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
                () => {
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
                    className="input text-sm py-2"
                />
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-auto px-2">
                {filteredRooms.length > 0 ? (
                    filteredRooms.map((room) => (
                        <Link
                            key={room.id}
                            href={`/talk/${room.id}`}
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
                                    {room.unread_count > 0 && (
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
        </div>
    );
}
