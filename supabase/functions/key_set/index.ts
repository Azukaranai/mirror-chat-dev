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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const authHeader = req.headers.get('Authorization')!;
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { apiKey } = await req.json();

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

        const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') ?? '';
        const encryptedKey = await encryptApiKey(trimmedKey, encryptionSecret);
        const last4 = trimmedKey.slice(-4);

        // Upsert key
        const { error: upsertError } = await supabase.from('user_llm_keys').upsert({
            user_id: user.id,
            encrypted_key: encryptedKey,
            key_last4: last4,
            provider: 'openai',
        });
        if (upsertError) {
            throw upsertError;
        }

        return new Response(JSON.stringify({ ok: true, last4 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
