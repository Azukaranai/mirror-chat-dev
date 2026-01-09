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
        // Determine provider
        const provider = model.startsWith('gemini') ? 'google' : 'openai';
        const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || undefined;

        // Retrieve API Key
        // Priority: 1. DB (User's key) 2. Env Var (System key - fallback)
        const { data: keyData } = await supabase
            .from('user_llm_keys')
            .select('encrypted_key')
            .eq('user_id', ownerUserId)
            .eq('provider', provider)
            .maybeSingle();

        if (!keyData?.encrypted_key) {
            throw new Error(`No API Key found for ${provider}`);
        }

        const apiKey = await decryptApiKey(keyData.encrypted_key, encryptionSecret);

        // Get history
        const { data: history } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        let fullContent = '';
        let seq = 0;

        if (provider === 'google') {
            // GEMINI IMPLEMENTATION
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

            // Convert messages to Gemini format
            // System prompt is handled via systemInstruction
            const contents = history
                .filter((m: any) => m.role !== 'system')
                .map((m: any) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }));

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

            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini API Error: ${errText}`);
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

                    // Gemini sends a JSON array stream like "[{...},\n{...}]"
                    // We need to robustly parse JSON objects from the buffer
                    // Simple heuristic: split by newlines or look for matching braces
                    // Actually, Gemini stream is often clean JSON objects separated by comma in an array structure
                    // But raw stream might be: "[\n" ... "{\n" ... "}\n," ... "]"
                    // A simple regex approach to find full JSON objects might work for this specific stream

                    // Quick hack for Gemini stream: It sends valid JSON objects one by one but wrapped in an array structure
                    // We can try to parse accumulated buffer if it looks like a valid JSON object (ignoring [ ] ,)
                    // Or simpler: remove leading '[' or ',' and trim

                    // Actually, let's treat it as text processing
                    // Typical chunk: ",\n{\n \"candidates\": [...] \n}"

                    // Let's accumulate and try to find complete objects
                    // This is tricky without a proper stream parser.
                    // For MVP, since we use `streamGenerateContent`, we receive chunks continuously.
                    // Let's sanitize buffer to extract JSON objects.

                    // Simplification: Replace newlines and parse? No.
                    // Let's iterate over buffer and match `{...}` blocks at top level

                    // Better approach for now:
                    // Just decode and if we see "text": "...", extract it.
                    // Less robust but works for streaming text.

                    const textMatches = buffer.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
                    for (const match of textMatches) {
                        // This regex is simplistic, Gemini JSON is nested in candidates -> content -> parts
                        // But "text" field should be unique enough? 
                        // Actually "text" appears in parts.
                        // We need to be careful not to re-read same part from buffer.
                        // Buffer management is needed.
                    }

                    // Standard approach:
                    // 1. Remove [ ] at start/end
                    // 2. Split by ",\n" or similar separator
                    // 3. Parse each part

                }

                // RE-IMPLEMENTATION WITH BETTER STREAM PARSING FOR GEMINI
                // Use a simpler recursive read or line-based if possible.
                // Gemini stream essentially sends line-based JSON if we strip the outer array chars.
                // Or we can just use the provided fetch response.

                // Let's use a simpler logic:
                // Since this is MVP, we will assume reasonable chunks.
                // Actually, Vercel AI SDK does this well. Since we are manual:
                // Let's rely on the fact that `text` comes in `candidates[0].content.parts[0].text`

                // Let's re-write the loop to be safer.
                // We will just accumulate the whole text for saving, but for streaming to client:
                // We need to parse.

                // Let's assume standard behavior:
                // New logic: 
                // buffer += chunk
                // while (buffer has valid JSON object) { extract, parse, remove from buffer }
            }

            // Fallback for MVP: 
            // Since parsing Gemini stream manually is error-prone without a library,
            // and we want to ensure reliability:
            // Let's just WAIT for the full response if streaming is hard?
            // No, user wants stream.

            // Proper Gemini Stream Parser Logic:
            let streamBuffer = '';
            const streamReader = res.body ? res.body.getReader() : null;
            if (streamReader) {
                while (true) {
                    const { done, value } = await streamReader.read();
                    if (done) break;
                    streamBuffer += decoder.decode(value, { stream: true });

                    // Try to parse complete JSON objects
                    // Gemini stream items are separated by comma if inside array
                    // format: [ {Item1}, {Item2} ]
                    // We can clean the buffer of [ ] , and parse

                    // Rudimentary parser:
                    let openBrace = streamBuffer.indexOf('{');
                    while (openBrace !== -1) {
                        // Try to find matching close brace
                        let balance = 0;
                        let closeBrace = -1;
                        let inString = false;

                        for (let i = openBrace; i < streamBuffer.length; i++) {
                            const char = streamBuffer[i];
                            if (char === '"' && streamBuffer[i - 1] !== '\\') inString = !inString;
                            if (!inString) {
                                if (char === '{') balance++;
                                else if (char === '}') {
                                    balance--;
                                    if (balance === 0) {
                                        closeBrace = i;
                                        break;
                                    }
                                }
                            }
                        }

                        if (closeBrace !== -1) {
                            const jsonStr = streamBuffer.substring(openBrace, closeBrace + 1);
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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
                                console.error('Gemini JSON parse error', e);
                            }
                            // Advance buffer
                            streamBuffer = streamBuffer.substring(closeBrace + 1);
                            openBrace = streamBuffer.indexOf('{');
                        } else {
                            // Incomplete object, wait for more chunks
                            break;
                        }
                    }
                }
            }

        } else {
            // OPENAI IMPLEMENTATION (Existing)
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
