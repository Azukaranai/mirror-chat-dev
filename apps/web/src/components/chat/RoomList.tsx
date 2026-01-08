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
        const fetchRooms = async () => {
            setLoading(true);

            // Get rooms user is member of
            const { data: memberOf } = await supabase
                .from('room_members')
                .select(`
          room_id,
          last_read_message_id,
          rooms!inner(id, type, group_id, created_at)
        `)
                .eq('user_id', userId);

            if (!memberOf) {
                setLoading(false);
                return;
            }

            const roomList: Room[] = [];

            for (const m of memberOf as any[]) {
                const room = Array.isArray(m.rooms) ? m.rooms[0] : m.rooms;
                let name = '';
                let avatarPath: string | null = null;
                let otherHandle: string | null = null;

                if ((room as any).type === 'dm') {
                    // Get other user in DM
                    const { data: otherMember } = await supabase
                        .from('room_members')
                        .select('user_id, profiles!inner(display_name, avatar_path, handle)')
                        .eq('room_id', room.id)
                        .neq('user_id', userId)
                        .single();

                    if (otherMember) {
                        const profile = (otherMember as any).profiles;
                        const resolved = Array.isArray(profile) ? profile[0] : profile;
                        name = resolved.display_name;
                        avatarPath = resolved.avatar_path;
                        otherHandle = resolved.handle;
                    }
                } else {
                    // Get group info
                    const { data: group } = await supabase
                        .from('groups')
                        .select('name, avatar_path')
                        .eq('id', (room as any).group_id)
                        .single();

                    if (group) {
                        name = (group as any).name;
                        avatarPath = (group as any).avatar_path;
                    }
                }

                // Get last message
                const { data: lastMsg } = await supabase
                    .from('messages')
                    .select('content, created_at, kind')
                    .eq('room_id', room.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // Count unread messages
                let unreadCount = 0;
                if (m.last_read_message_id) {
                    const { data: lastRead } = await supabase
                        .from('messages')
                        .select('created_at')
                        .eq('id', m.last_read_message_id)
                        .single();

                    if (lastRead) {
                        const { count } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('room_id', room.id)
                            .gt('created_at', (lastRead as any).created_at);

                        unreadCount = count || 0;
                    }
                } else if (lastMsg) {
                    // No last read - count all messages
                    const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('room_id', room.id);

                    unreadCount = count || 0;
                }

                let lastMessageContent = (lastMsg as any)?.content || '';
                if ((lastMsg as any)?.kind === 'shared_ai_thread') {
                    lastMessageContent = '🤖 AIスレッドを共有しました';
                } else if ((lastMsg as any)?.kind === 'attachment') {
                    lastMessageContent = '📎 添付ファイル';
                }

                roomList.push({
                    id: room.id,
                    type: (room as any).type,
                    name,
                    avatar_path: avatarPath,
                    handle: otherHandle,
                    last_message: lastMessageContent,
                    last_message_at: (lastMsg as any)?.created_at,
                    unread_count: unreadCount,
                });
            }

            // Sort by last message time
            roomList.sort((a, b) => {
                if (!a.last_message_at) return 1;
                if (!b.last_message_at) return -1;
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
            });

            setRooms(roomList);
            setLoading(false);
        };

        fetchRooms();

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
                    fetchRooms();
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
                                {room.handle === 'mirror' ? (
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
