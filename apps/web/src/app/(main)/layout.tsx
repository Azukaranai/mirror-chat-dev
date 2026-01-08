import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MainNav } from '@/components/nav/MainNav';
import { MobileNav } from '@/components/nav/MobileNav';
import { OverlayManager } from '@/components/overlay/OverlayManager';

export default async function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <div className="h-screen h-[100dvh] flex flex-col md:flex-row overflow-hidden">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64 border-r border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900">
                <MainNav />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden safe-top">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 safe-bottom">
                <MobileNav />
            </nav>

            {/* Overlay Windows (Desktop only) */}
            <div className="hidden md:block">
                <OverlayManager />
            </div>
        </div>
    );
}
