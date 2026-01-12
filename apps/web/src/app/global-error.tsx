'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body className="font-sans antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center p-4">
                    <h2 className="mb-4 text-2xl font-bold">予期せぬエラーが発生しました</h2>
                    <button
                        onClick={() => reset()}
                        className="rounded-lg bg-primary-600 px-6 py-2.5 text-white transition-colors hover:bg-primary-700"
                    >
                        再試行
                    </button>
                </div>
            </body>
        </html>
    );
}
