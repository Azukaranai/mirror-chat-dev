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

    console.log('ai_send_message called');

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get user from auth header
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
        if (!authHeader) {
            console.error('Missing Authorization header');
            throw new Error('Missing Authorization header');
        }

        console.log('Auth header found, validating user...');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('Auth error:', authError?.message);
            return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('User authenticated:', user.id);

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

        // Check if already running
        const { data: existingRun } = await supabase
            .from('ai_runs')
            .select('id, created_at')
            .eq('thread_id', threadId)
            .eq('status', 'running')
            .maybeSingle();

        if (existingRun) {
            // If the run is older than 2 minutes, consider it stuck and mark as failed
            const runTime = new Date(existingRun.created_at).getTime();
            const now = Date.now();
            if (now - runTime > 2 * 60 * 1000) {
                console.log('Found stuck run, marking as failed:', existingRun.id);
                await supabase
                    .from('ai_runs')
                    .update({ status: 'failed', error: 'Timeout/Stuck detected by new request' })
                    .eq('id', existingRun.id);
            } else {
                console.log('Thread is currently running:', existingRun.id);
                return new Response(JSON.stringify({ error: 'Already running' }), {
                    status: 409,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
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
        // Determine provider
        const provider = model.startsWith('gemini') ? 'google' : 'openai';
        console.log('Processing AI response. Provider:', provider, 'Model:', model);

        const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || undefined;
        if (!encryptionSecret) {
            console.error('ENCRYPTION_SECRET not set!');
        }

        // Retrieve API Key
        console.log('Fetching API key for user:', ownerUserId, 'provider:', provider);
        const { data: keyData, error: keyError } = await supabase
            .from('user_llm_keys')
            .select('encrypted_key')
            .eq('user_id', ownerUserId)
            .eq('provider', provider)
            .maybeSingle();

        if (keyError) {
            console.error('Error fetching key:', keyError);
        }

        if (!keyData?.encrypted_key) {
            console.error('No key found in database');
            throw new Error(`No API Key found for ${provider}`);
        }

        console.log('Decrypting API key...');
        const apiKey = await decryptApiKey(keyData.encrypted_key, encryptionSecret);
        console.log('API key decrypted, length:', apiKey?.length || 0);

        // Get history
        const { data: rawHistory } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        let fullContent = '';
        let seq = 0;

        if (provider === 'google') {
            // GEMINI IMPLEMENTATION (Steady - Non-Streaming)
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            // Format for Gemini and handle role alternation
            let contents: any[] = [];
            if (rawHistory) {
                rawHistory.forEach((msg: any) => {
                    if (msg.role === 'system') return;

                    const currentRole = msg.role === 'user' ? 'user' : 'model';
                    const last = contents[contents.length - 1];

                    if (last && last.role === currentRole) {
                        // Merge with previous if same role (Gemini requires alternating roles)
                        last.parts[0].text += "\n\n" + msg.content;
                    } else {
                        contents.push({
                            role: currentRole,
                            parts: [{ text: msg.content }]
                        });
                    }
                });
            }

            // If the last message is from model, remove it so we respond to the user's last message
            if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
                console.log('Removing trailing model message from history context');
                contents.pop();
            }

            const body: any = {
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                }
            };

            if (systemPrompt) {
                body.systemInstruction = {
                    parts: [{ text: systemPrompt }]
                };
            }

            console.log('Calling Gemini API (non-streaming):', model);

            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini API Error: ${errText}`);
            }

            const result = await res.json();
            console.log('Gemini response received:', JSON.stringify(result).substring(0, 200));

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                fullContent = text;
                // Non-streaming: do not send stream events to avoid duplicate display
            } else {
                console.error('Invalid Gemini response:', JSON.stringify(result));
                throw new Error('No response content from Gemini');
            }
        } else {
            // OPENAI IMPLEMENTATION (Existing)
            const messages = [
                { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
                ...rawHistory.map((m: any) => ({ role: m.role, content: m.content }))
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
        }

        // Save final message
        console.log('Saving final assistant message, content length:', fullContent.length);
        const { error: msgError } = await supabase.from('ai_messages').insert({
            thread_id: threadId,
            role: 'assistant',
            sender_kind: 'assistant',
            content: fullContent,
        });

        if (msgError) {
            console.error('Failed to save message:', msgError);
        } else {
            console.log('Message saved successfully');
        }

        // Complete run
        await supabase.from('ai_runs').update({
            status: 'completed',
            finished_at: new Date().toISOString(),
        }).eq('id', runId);

        console.log('Run completed:', runId);

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
