// Supabase Edge Function: ai_process_queue
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptApiKey } from '../_shared/crypto.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
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

        // Resolve user id (allow x-user-id and body.userId fallback; fallback to thread owner later)
        const authHeader = req.headers.get('Authorization');
        let userId: string | null = null;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const parseJwtSub = (jwt: string): string | null => {
                try {
                    const payload = jwt.split('.')[1];
                    if (!payload) return null;
                    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
                    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
                    const decoded = atob(padded);
                    const parsed = JSON.parse(decoded);
                    return parsed?.sub || null;
                } catch {
                    return null;
                }
            };
            userId = parseJwtSub(token);
        }
        if (!userId) {
            const debugUser = req.headers.get('x-user-id');
            if (debugUser) userId = debugUser;
        }
        if (!userId) {
            try {
                const bodyForUser = await req.clone().json();
                if (bodyForUser?.userId) {
                    userId = bodyForUser.userId;
                }
            } catch {
                // ignore
            }
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
            .select('id, owner_user_id, model, system_prompt')
            .eq('id', threadId)
            .single();

        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const user = { id: userId ?? thread.owner_user_id };

        const { data: running } = await supabase
            .from('ai_runs')
            .select('id')
            .eq('thread_id', threadId)
            .eq('status', 'running')
            .maybeSingle();

        if (running) {
            return new Response(JSON.stringify({ queued: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: queueItem } = await supabase
            .from('ai_queue_items')
            .select('*')
            .eq('thread_id', threadId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (!queueItem) {
            return new Response(JSON.stringify({ ok: true, processed: false }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: consumedItem, error: consumeError } = await supabase
            .from('ai_queue_items')
            .update({
                status: 'consumed',
                consumed_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id)
            .eq('status', 'pending')
            .select()
            .maybeSingle();

        if (consumeError || !consumedItem) {
            return new Response(JSON.stringify({ queued: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { error: insertError } = await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'user',
            sender_user_id: queueItem.user_id,
            sender_kind: queueItem.kind,
            content: queueItem.content,
        });

        if (insertError) {
            throw insertError;
        }

        const { data: newRun, error: runError } = await supabase
            .from('ai_runs')
            .insert({
                thread_id: threadId,
            })
            .select()
            .single();

        if (runError || !newRun) {
            throw runError;
        }

        await processAIResponse(
            supabase,
            threadId,
            newRun.id,
            thread.model,
            thread.system_prompt,
            thread.owner_user_id
        );

        return new Response(JSON.stringify({ processed: true, runId: newRun.id, queueItemId: queueItem.id }), {
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
        const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || undefined;

        const { data: keyData } = await supabase
            .from('user_llm_keys')
            .select('encrypted_key')
            .eq('user_id', ownerUserId)
            .maybeSingle();

        if (!keyData?.encrypted_key) {
            throw new Error('No OpenAI API Key found');
        }

        const apiKey = await decryptApiKey(keyData.encrypted_key, encryptionSecret);

        const { data: history } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        const contextGuide = 'System: Lines starting with [CHAT_CONTEXT] are chat log excerpts from the linked talk. Treat them as user-provided context. Remove the prefix when reasoning. If no context is present, answer normally.';
        const effectiveSystem = systemPrompt
            ? `${systemPrompt}\n\n${contextGuide}`
            : `You are a helpful AI assistant.\n\n${contextGuide}`;

        const messages = [
            { role: 'system', content: effectiveSystem },
            ...(history || []).map((m: any) => {
                // チャットコンテキストは user ロールとして扱い、プレフィックスを残す（LLMが文脈として読めるように）
                if (typeof m.content === 'string' && m.content.startsWith('[CHAT_CONTEXT]')) {
                    // プレフィックスは取り除き、文脈として渡す
                    const stripped = m.content.replace(/^\[CHAT_CONTEXT\]\s*/, '');
                    return { role: 'user', content: `【トーク文脈】${stripped}` };
                }
                return { role: m.role, content: m.content };
            }),
        ];

        // Debug: log messages being sent to the model (without apiKey)
        console.log('AI_PROCESS_QUEUE messages payload', {
            threadId,
            runId,
            model,
            messageCount: messages.length,
            preview: messages.slice(0, 6).map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 120) : m.content })),
        });

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

        await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'assistant',
            sender_kind: 'assistant',
            content: fullContent,
        });

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

        await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'system',
            sender_kind: 'system',
            content: `Error: ${error.message}`,
        });
    }
}
