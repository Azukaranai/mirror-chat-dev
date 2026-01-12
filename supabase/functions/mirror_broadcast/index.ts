// Supabase Edge Function: mirror_broadcast
// Ensures Mirror account friendships/DM rooms and broadcasts a release message.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mirror-admin',
};

interface BroadcastBody {
    message: string;
    dryRun?: boolean;
}

function chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function findUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
    let page = 1;
    const perPage = 200;
    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) {
            throw error;
        }
        const users = data?.users || [];
        const found = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
        if (found) {
            return found;
        }
        if (users.length < perPage) {
            break;
        }
        page += 1;
    }
    return null;
}

async function ensureMirrorUser(supabase: ReturnType<typeof createClient>) {
    const mirrorUserIdEnv = Deno.env.get('MIRROR_USER_ID') || '';
    const mirrorEmail = Deno.env.get('MIRROR_EMAIL') || 'mirror@mirror.chat';
    const mirrorDisplayName = Deno.env.get('MIRROR_DISPLAY_NAME') || 'Mirror';
    const mirrorHandle = Deno.env.get('MIRROR_HANDLE') || 'mirror';

    if (mirrorUserIdEnv) {
        return { userId: mirrorUserIdEnv, displayName: mirrorDisplayName, handle: mirrorHandle };
    }

    const { data: profileByHandle } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('handle', mirrorHandle)
        .maybeSingle();

    if (profileByHandle?.user_id) {
        return { userId: profileByHandle.user_id, displayName: mirrorDisplayName, handle: mirrorHandle };
    }

    const existing = await findUserByEmail(supabase, mirrorEmail);
    if (existing?.id) {
        return { userId: existing.id, displayName: mirrorDisplayName, handle: mirrorHandle };
    }

    const randomPassword = crypto.randomUUID() + 'Aa1!';
    const { data, error } = await supabase.auth.admin.createUser({
        email: mirrorEmail,
        password: Deno.env.get('MIRROR_PASSWORD') || randomPassword,
        email_confirm: true,
        user_metadata: {
            display_name: mirrorDisplayName,
            handle: mirrorHandle,
        },
    });

    if (error || !data.user?.id) {
        throw error || new Error('Failed to create Mirror user');
    }

    return { userId: data.user.id, displayName: mirrorDisplayName, handle: mirrorHandle };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const adminToken = Deno.env.get('MIRROR_ADMIN_TOKEN') || '';
    const providedToken = req.headers.get('x-mirror-admin')
        || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!adminToken || providedToken !== adminToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = (await req.json()) as BroadcastBody;
        const message = (body.message || '').trim();
        const dryRun = Boolean(body.dryRun);

        if (!message) {
            return new Response(JSON.stringify({ error: 'Missing message' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const announcement = message.startsWith('【')
            ? message
            : `【運営からのお知らせ】\n${message}`;

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            ?? Deno.env.get('SERVICE_ROLE_KEY')
            ?? '';
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const mirror = await ensureMirrorUser(supabase);
        const mirrorUserId = mirror.userId;

        const { data: mirrorProfile } = await supabase
            .from('profiles')
            .select('user_id, handle')
            .eq('user_id', mirrorUserId)
            .maybeSingle();

        if (!mirrorProfile) {
            await supabase.from('profiles').insert({
                user_id: mirrorUserId,
                display_name: mirror.displayName,
                handle: mirror.handle,
            } as any);
        } else if ((mirrorProfile as any)?.handle === mirror.handle) {
            await supabase.from('profiles').update({
                display_name: mirror.displayName,
            }).eq('user_id', mirrorUserId);
        }

        const { data: users } = await supabase
            .from('profiles')
            .select('user_id')
            .neq('user_id', mirrorUserId);

        const userIds = (users || []).map((row: any) => row.user_id);

        let createdFriendships = 0;
        let updatedFriendships = 0;
        let createdRooms = 0;

        for (const userChunk of chunk(userIds, 100)) {
            const inList = userChunk.join(',');
            const { data: existingRelations } = await supabase
                .from('friendships')
                .select('id, status, requester_id, addressee_id')
                .or(`and(requester_id.eq.${mirrorUserId},addressee_id.in.(${inList})),and(addressee_id.eq.${mirrorUserId},requester_id.in.(${inList}))`);

            const existingMap = new Map<string, any>();
            (existingRelations || []).forEach((row: any) => {
                const otherId = row.requester_id === mirrorUserId ? row.addressee_id : row.requester_id;
                existingMap.set(otherId, row);
            });

            const toAccept = (existingRelations || []).filter((row: any) => row.status !== 'accepted');
            if (toAccept.length > 0 && !dryRun) {
                const ids = toAccept.map((row: any) => row.id);
                const { error: acceptError } = await supabase
                    .from('friendships')
                    .update({ status: 'accepted' })
                    .in('id', ids);
                if (!acceptError) {
                    updatedFriendships += ids.length;
                }
            }

            const missing = userChunk.filter((id) => !existingMap.has(id));
            if (missing.length > 0 && !dryRun) {
                const { error: insertError } = await supabase
                    .from('friendships')
                    .insert(missing.map((id) => ({
                        requester_id: mirrorUserId,
                        addressee_id: id,
                        status: 'accepted',
                    })));
                if (!insertError) {
                    createdFriendships += missing.length;
                }
            }
        }

        const { data: mirrorRooms } = await supabase
            .from('room_members')
            .select('room_id, rooms!inner(type)')
            .eq('user_id', mirrorUserId);

        const dmRoomIds = (mirrorRooms || [])
            .filter((row: any) => (Array.isArray(row.rooms) ? row.rooms[0] : row.rooms)?.type === 'dm')
            .map((row: any) => row.room_id);

        const roomByUser = new Map<string, string>();

        if (dmRoomIds.length > 0) {
            for (const roomChunk of chunk(dmRoomIds, 200)) {
                const { data: members } = await supabase
                    .from('room_members')
                    .select('room_id, user_id')
                    .in('room_id', roomChunk)
                    .neq('user_id', mirrorUserId);

                (members || []).forEach((row: any) => {
                    if (!roomByUser.has(row.user_id)) {
                        roomByUser.set(row.user_id, row.room_id);
                    }
                });
            }
        }

        if (!dryRun) {
            for (const userId of userIds) {
                if (roomByUser.has(userId)) continue;
                const { data: newRoom, error: roomError } = await supabase
                    .from('rooms')
                    .insert({ type: 'dm' } as any)
                    .select('id')
                    .single();

                if (roomError || !newRoom) {
                    continue;
                }

                await supabase.from('room_members').insert([
                    { room_id: (newRoom as any).id, user_id: userId },
                    { room_id: (newRoom as any).id, user_id: mirrorUserId },
                ] as any);

                roomByUser.set(userId, (newRoom as any).id);
                createdRooms += 1;
            }
        }

        let sentMessages = 0;
        if (!dryRun) {
            const messageRows = userIds
                .map((userId) => roomByUser.get(userId))
                .filter(Boolean)
                .map((roomId) => ({
                    room_id: roomId,
                    sender_user_id: mirrorUserId,
                    kind: 'system',
                    content: announcement,
                }));

            for (const messageChunk of chunk(messageRows, 200)) {
                const { error: messageError } = await supabase.from('messages').insert(messageChunk as any);
                if (!messageError) {
                    sentMessages += messageChunk.length;
                }
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            mirrorUserId,
            users: userIds.length,
            createdFriendships,
            updatedFriendships,
            createdRooms,
            sentMessages,
            dryRun,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
