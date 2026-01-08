// Supabase Edge Function: ai_duplicate_thread
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
    threadId: string;
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

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { threadId }: RequestBody = await req.json();
        if (!threadId) {
            return new Response(JSON.stringify({ error: 'Missing threadId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: thread } = await supabase
            .from('ai_threads')
            .select('id, owner_user_id, title, model, system_prompt')
            .eq('id', threadId)
            .single();

        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (thread.owner_user_id !== user.id) {
            const { data: membership } = await supabase
                .from('ai_thread_members')
                .select('thread_id')
                .eq('thread_id', threadId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!membership) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        const { data: newThread, error: createError } = await supabase
            .from('ai_threads')
            .insert({
                owner_user_id: user.id,
                title: `${thread.title} (コピー)`,
                model: thread.model,
                system_prompt: thread.system_prompt,
            })
            .select()
            .single();

        if (createError || !newThread) {
            return new Response(JSON.stringify({ error: 'Failed to create thread' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: messages } = await supabase
            .from('ai_messages')
            .select('role, content, sender_kind, sender_user_id, created_at')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        if (messages && messages.length > 0) {
            await supabase.from('ai_messages').insert(
                messages.map((msg: any) => ({
                    thread_id: newThread.id,
                    role: msg.role,
                    content: msg.content,
                    sender_kind: msg.sender_kind,
                    sender_user_id: msg.sender_user_id,
                    created_at: msg.created_at,
                }))
            );
        }

        return new Response(JSON.stringify({ newThreadId: newThread.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
