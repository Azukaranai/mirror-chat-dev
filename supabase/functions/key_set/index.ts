// Supabase Edge Function: key_set
// Stores encrypted API key for a user

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptApiKey } from '../_shared/crypto.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Log all headers for debugging
        const headersList: Record<string, string> = {};
        req.headers.forEach((value, key) => {
            headersList[key] = key.toLowerCase() === 'authorization' ? 'Bearer [REDACTED]' : value;
        });
        console.log('Request headers:', JSON.stringify(headersList));

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            ?? Deno.env.get('SERVICE_ROLE_KEY')
            ?? '';
        if (!serviceRoleKey) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
            return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create admin client for database operations
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // Get Authorization header
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

        if (!authHeader) {
            console.error('Missing Authorization header. Available headers:', Object.keys(headersList).join(', '));
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('Token length:', token.length, 'Token prefix:', token.substring(0, 20));

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error('Auth error:', authError?.message || 'No user found');
            return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('User authenticated:', user.id);

        const body = await req.json();
        const { apiKey, provider = 'openai' } = body;

        if (!apiKey || typeof apiKey !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid API key' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            return new Response(JSON.stringify({ error: 'Invalid API key' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check if already encrypted with v2 (client-side encryption)
        // v2: format means client encrypted - we store as-is
        const isClientEncrypted = trimmedKey.startsWith('v2:');

        let encryptedKey: string;
        let last4: string;

        if (isClientEncrypted) {
            // Client-side encrypted - store as-is
            // Server cannot decrypt this - that's the point!
            encryptedKey = trimmedKey;
            // Extract last4 from a separate field sent by client
            last4 = body.last4 || '****';
            console.log('Storing client-encrypted key for user:', user.id);
        } else {
            // Legacy: server-side encryption
            const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') ?? '';
            if (!encryptionSecret) {
                console.error('ENCRYPTION_SECRET is not set');
                return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            encryptedKey = await encryptApiKey(trimmedKey, encryptionSecret);
            last4 = trimmedKey.slice(-4);
        }

        console.log('Upserting key for user:', user.id, 'provider:', provider, 'client_encrypted:', isClientEncrypted);

        // Upsert key with explicit onConflict for composite primary key
        const { error: upsertError } = await supabaseAdmin.from('user_llm_keys').upsert(
            {
                user_id: user.id,
                encrypted_key: encryptedKey,
                key_last4: last4,
                provider: provider,
            },
            {
                onConflict: 'user_id,provider',
            }
        );

        if (upsertError) {
            console.error('Upsert error:', upsertError);
            throw upsertError;
        }

        console.log('Key saved successfully');

        return new Response(JSON.stringify({ ok: true, last4 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('key_set error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
