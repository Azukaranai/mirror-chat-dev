'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores';

export function UIInitializer() {
    const theme = useUIStore((state) => state.theme);
    const fontScale = useUIStore((state) => state.fontScale);

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

    return null;
}
