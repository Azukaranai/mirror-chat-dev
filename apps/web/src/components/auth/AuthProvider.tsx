'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
    userId: string | null;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ userId: null, isLoading: true });

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        const clearLocalSession = () => {
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                if (!supabaseUrl) return;
                const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
                if (projectRef) {
                    localStorage.removeItem(`sb-${projectRef}-auth-token`);
                }
            } catch {
                // ignore
            }
        };

        const resolveSession = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            if (accessToken) {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    setIsLoading(false);
                    return;
                }

                if (error?.message?.toLowerCase().includes('invalid jwt')) {
                    const { data: refreshed } = await supabase.auth.refreshSession();
                    if (refreshed.session?.user) {
                        setUserId(refreshed.session.user.id);
                        setIsLoading(false);
                        return;
                    }
                    await supabase.auth.signOut({ scope: 'local' });
                    clearLocalSession();
                }
            } else {
                clearLocalSession();
            }

            router.replace('/login');
            setIsLoading(false);
        };

        resolveSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setUserId(null);
                router.replace('/login');
            } else if (session?.user) {
                setUserId(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return (
        <AuthContext.Provider value={{ userId, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
