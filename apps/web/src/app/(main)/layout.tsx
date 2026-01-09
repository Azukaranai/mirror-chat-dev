'use client';

import { MainNav } from '@/components/nav/MainNav';
import { MobileNav } from '@/components/nav/MobileNav';
import { OverlayManager } from '@/components/overlay/OverlayManager';
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <div className="h-screen h-[100dvh] flex flex-col md:flex-row overflow-hidden">
                {/* Desktop Sidebar Navigation */}
                <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64 border-r border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900">
                    <MainNav />
                </aside>

                {/* Main Content Area - 認証チェック中もchildrenを表示し続ける */}
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden safe-top">
                    {children}
                </main>

                {/* Mobile Bottom Navigation */}
                <MobileNav />

                {/* Overlay Windows (Desktop only) */}
                <div className="hidden md:block">
                    <OverlayManager />
                </div>
            </div>
        </AuthProvider>
    );
}
