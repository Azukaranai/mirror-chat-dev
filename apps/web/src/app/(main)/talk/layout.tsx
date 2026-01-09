import { createClient } from '@/lib/supabase/server';
import { TalkLayout } from '@/components/chat/TalkLayout';

export default async function TalkRootLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    return <TalkLayout userId={user.id}>{children}</TalkLayout>;
}
