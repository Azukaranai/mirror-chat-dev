'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

interface BuildInfo {
    timestamp: string;
}

interface VersionDisplayProps {
    className?: string;
}

export function VersionDisplay({ className }: VersionDisplayProps) {
    const [info, setInfo] = useState<BuildInfo | null>(null);

    useEffect(() => {
        fetch(`/build-info.json?t=${Date.now()}`)
            .then((res) => res.json())
            .then((data) => setInfo(data))
            .catch(() => setInfo(null));
    }, []);

    const date = info?.timestamp
        ? new Date(info.timestamp).toLocaleString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null;

    return (
        <span className={cn("text-xs text-surface-400 dark:text-surface-600", className)}>
            v{APP_VERSION}{date ? ` · ${date}` : ''}
        </span>
    );
}
