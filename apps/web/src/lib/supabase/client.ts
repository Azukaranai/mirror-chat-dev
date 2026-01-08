import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Singleton for client-side usage
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (typeof window === 'undefined') {
        // Don't create client during SSR/build
        throw new Error('getSupabaseClient should only be called on the client side');
    }
    if (!client) {
        client = createClient();
    }
    return client;
}

