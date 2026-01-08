// Supabase Edge Function: ai_send_message
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptApiKey } from '../_shared/crypto.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
    threadId: string;
    content: string;
    kind: 'owner' | 'collaborator';
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get user from auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
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

        const { threadId, content, kind }: RequestBody = await req.json();

        // Verify thread access
        const { data: thread } = await supabase
            .from('ai_threads')
            .select('*')
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
                .select('permission')
                .eq('thread_id', threadId)
                .eq('user_id', user.id)
                .single();

            if (!membership) {
                return new Response(JSON.stringify({ error: 'Thread not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (kind === 'collaborator' && membership.permission !== 'INTERVENE') {
                return new Response(JSON.stringify({ error: 'No intervene permission' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Check running run
        const { data: runningRun } = await supabase
            .from('ai_runs')
            .select('id')
            .eq('thread_id', threadId)
            .eq('status', 'running')
            .maybeSingle(); // maybeSingle allows null

        if (runningRun) {
            await supabase.from('ai_queue_items').insert({
                thread_id: threadId,
                user_id: user.id,
                kind,
                content,
                status: 'pending',
            });
            return new Response(JSON.stringify({ queued: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create new run
        const { data: newRun, error: runError } = await supabase
            .from('ai_runs')
            .insert({
                thread_id: threadId,
                status: 'running',
            })
            .select()
            .single();

        if (runError) {
            // Race condition
            await supabase.from('ai_queue_items').insert({
                thread_id: threadId,
                user_id: user.id,
                kind,
                content,
                status: 'pending',
            });
            return new Response(JSON.stringify({ queued: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Insert user message
        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();

        await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'user',
            sender_user_id: user.id,
            sender_kind: kind,
            content,
        });

        // Trigger background processing (Deno.serve doesn't support generic background tasks easily without blocking response, 
        // but we can return response then process if we structure it right, or just keep connection open?)
        // Edge Functions have execution time limit. Using simple await here is safer for MVP. 
        // For true background, we'd need another mechanism.
        // We will 'await' the process for now to ensure completion.

        await processAIResponse(supabase, threadId, newRun.id, thread.model, thread.system_prompt, thread.owner_user_id);

        return new Response(JSON.stringify({ started: true, runId: newRun.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

async function processAIResponse(
    supabase: any,
    threadId: string,
    runId: string,
    model: string,
    systemPrompt: string | null,
    ownerUserId: string
) {
    try {
        // Retrieve API Key
        // Priority: 1. DB (User's key) 2. Env Var (System key)
        let apiKey: string | undefined;
        const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || undefined;

        const { data: keyData } = await supabase
            .from('user_llm_keys')
            .select('encrypted_key')
            .eq('user_id', ownerUserId)
            .maybeSingle();

        if (!keyData?.encrypted_key) {
            throw new Error('No OpenAI API Key found');
        }

        apiKey = await decryptApiKey(keyData.encrypted_key, encryptionSecret);

        // Get history
        const { data: history } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        const messages = [
            { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
            ...history.map((m: any) => ({ role: m.role, content: m.content }))
        ];

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI API Error: ${errText}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let seq = 0;

        if (reader) {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullContent += delta;
                                await supabase.from('ai_stream_events').insert({
                                    thread_id: threadId,
                                    run_id: runId,
                                    seq: seq++,
                                    delta,
                                });
                            }
                        } catch (e) {
                            console.error('Parse error', e);
                        }
                    }
                }
            }
        }

        // Save final message
        await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'assistant',
            sender_kind: 'assistant',
            content: fullContent,
        });

        // Complete run
        await supabase.from('ai_runs').update({
            status: 'completed',
            finished_at: new Date().toISOString(),
        }).eq('id', runId);

    } catch (error: any) {
        console.error('Processing error:', error);
        await supabase.from('ai_runs').update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error: error.message,
        }).eq('id', runId);

        // Save error message to chat
        await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'system',
            sender_kind: 'system',
            content: `Error: ${error.message}`,
        });
    }
}
