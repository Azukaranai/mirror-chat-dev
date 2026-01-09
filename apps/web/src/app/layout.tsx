import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { UIInitializer } from '@/components/ui/UIInitializer';
import { VersionDisplay } from '@/components/common/VersionDisplay'; // Import VersionDisplay

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
});

export const runtime = 'edge';

export const metadata: Metadata = {
    title: 'Mirror Chat',
    description: 'AIチャット共有アプリ - LINE/Discord風チャット + ChatGPT風AIスレッド',
    keywords: ['chat', 'AI', 'messaging', 'collaboration'],
    authors: [{ name: 'Mirror Chat Team' }],
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Mirror Chat',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    ],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" className={inter.variable} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var storage = localStorage.getItem('ui-storage');
                                    if (storage) {
                                        var state = JSON.parse(storage).state;
                                        var theme = state.theme;
                                        var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                                        if (isDark) {
                                            document.documentElement.classList.add('dark');
                                        } else {
                                            document.documentElement.classList.remove('dark');
                                        }
                                    } else {
                                        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                                            document.documentElement.classList.add('dark');
                                        }
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body className="font-sans antialiased">
                <UIInitializer />
                <VersionDisplay />
                {children}
            </body>
        </html>
    );
}
