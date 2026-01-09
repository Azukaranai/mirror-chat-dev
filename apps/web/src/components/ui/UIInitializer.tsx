'use client';

import { useEffect } from 'react';
import { useUIStore, useChatStore } from '@/lib/stores';

export function UIInitializer() {
    const theme = useUIStore((state) => state.theme);
    const fontScale = useUIStore((state) => state.fontScale);
    const fetchNotifications = useChatStore((state) => state.fetchNotifications);

    useEffect(() => {
        document.documentElement.style.setProperty('--font-scale', fontScale.toString());
    }, [fontScale]);

    useEffect(() => {
        const root = document.documentElement;
        const media = window.matchMedia('(prefers-color-scheme: dark)');

        const applySystem = () => {
            if (media.matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        if (theme === 'dark') {
            root.classList.add('dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
        } else {
            applySystem();
        }

        if (theme !== 'system') return;

        if (media.addEventListener) {
            media.addEventListener('change', applySystem);
            return () => media.removeEventListener('change', applySystem);
        }

        media.addListener(applySystem);
        return () => media.removeListener(applySystem);
    }, [theme]);

    // Initial fetch of notifications
    useEffect(() => {
        // Don't fetch on auth pages
        const isAuthPage = ['/login', '/register'].includes(window.location.pathname);
        if (!isAuthPage) {
            fetchNotifications();
        }
    }, [fetchNotifications]);

    return null;
}
