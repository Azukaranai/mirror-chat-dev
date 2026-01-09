'use client';

import { useEffect, useState } from 'react';

interface BuildInfo {
    timestamp: string;
    commitHash: string;
    commitMessage: string;
    branch: string;
}

export function VersionDisplay() {
    const [info, setInfo] = useState<BuildInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fetch with cache-busting
        fetch(`/build-info.json?t=${Date.now()}`)
            .then((res) => res.json())
            .then((data) => setInfo(data))
            .catch((err) => console.error('Failed to load version info', err));
    }, []);

    if (!info) return null;

    // Show only first 7 chars of hash
    const shortHash = info.commitHash.substring(0, 7);
    const date = new Date(info.timestamp).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div
            className="fixed bottom-1 right-1 z-50 text-[10px] text-surface-400 bg-surface-100/50 dark:bg-surface-900/50 px-2 py-1 rounded cursor-pointer hover:opacity-100 opacity-30 transition-opacity"
            onClick={() => setIsVisible(!isVisible)}
            title={info.commitMessage}
        >
            v:{shortHash} ({date})
            {isVisible && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-surface-50 dark:bg-surface-900 shadow-lg rounded-lg border border-surface-200 dark:border-surface-700 text-xs">
                    <p><strong>Commit:</strong> {info.commitHash}</p>
                    <p><strong>Message:</strong> {info.commitMessage}</p>
                    <p><strong>Branch:</strong> {info.branch}</p>
                    <p><strong>Built:</strong> {info.timestamp}</p>
                </div>
            )}
        </div>
    );
}
