'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { AIThreadPanel } from '@/components/ai/AIThreadPanel';
import { useSplitStore } from '@/lib/stores';
import { createClient } from '@/lib/supabase/client';

interface ChatSplitLayoutProps {
    roomId: string;
    userId: string;
}

export function ChatSplitLayout({ roomId, userId }: ChatSplitLayoutProps) {
    const {
        tabs,
        activeTabId,
        setActiveTab,
        removeTab,
        updateTab,
        splitRatio,
        setSplitRatio,
    } = useSplitStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const axisRef = useRef<'vertical' | 'horizontal'>('vertical');
    const [isMobile, setIsMobile] = useState(false);
    const [threadComposerFocused, setThreadComposerFocused] = useState(false);
    const [chatComposerFocused, setChatComposerFocused] = useState(false);

    const activeTab = useMemo(() => {
        if (activeTabId) {
            return tabs.find((tab) => tab.tabId === activeTabId) || null;
        }
        return tabs.length > 0 ? tabs[tabs.length - 1] : null;
    }, [tabs, activeTabId]);

    useEffect(() => {
        if (!activeTab && tabs.length > 0) {
            setActiveTab(tabs[tabs.length - 1].tabId);
        }
    }, [tabs, activeTab, setActiveTab]);

    useEffect(() => {
        const handlePointerMove = (event: globalThis.PointerEvent) => {
            if (!draggingRef.current) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const ratio = axisRef.current === 'vertical'
                ? (event.clientX - rect.left) / rect.width
                : (event.clientY - rect.top) / rect.height;

            const clamped = Math.min(0.75, Math.max(0.25, ratio));
            setSplitRatio(clamped);
        };

        const handlePointerUp = () => {
            draggingRef.current = false;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [setSplitRatio]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 768px)');
        const update = () => setIsMobile(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (!isMobile) {
            setThreadComposerFocused(false);
            setChatComposerFocused(false);
            return;
        }

        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.getAttribute('data-ai-thread-input') === 'true') {
                setThreadComposerFocused(true);
            }
            if (target?.getAttribute('data-chat-input') === 'true') {
                setChatComposerFocused(true);
            }
        };

        const handleFocusOut = () => {
            setTimeout(() => {
                const active = document.activeElement as HTMLElement | null;
                if (!active || active.getAttribute('data-ai-thread-input') !== 'true') {
                    setThreadComposerFocused(false);
                }
                if (!active || active.getAttribute('data-chat-input') !== 'true') {
                    setChatComposerFocused(false);
                }
            }, 0);
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, [isMobile]);

    // Realtime update for tab titles
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('split_view_global_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_threads',
                },
                (payload) => {
                    const updated = payload.new as any;
                    const currentTabs = useSplitStore.getState().tabs;
                    const updateFn = useSplitStore.getState().updateTab;

                    const targetTabs = currentTabs.filter(t => t.threadId === updated.id);
                    targetTabs.forEach(tab => {
                        if (tab.title !== updated.title) {
                            updateFn(tab.tabId, { title: updated.title });
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleDividerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        axisRef.current = window.innerWidth >= 768 ? 'vertical' : 'horizontal';
        draggingRef.current = true;
        event.preventDefault();
    };

    const talkFocusActive = chatComposerFocused && isMobile;
    const threadFocusActive = threadComposerFocused && isMobile;

    return (
        <div
            ref={containerRef}
            className={`flex h-full min-h-0 ${activeTab ? 'flex-col md:flex-row' : ''}`}
        >
            <div
                className={`flex-1 min-w-0 min-h-0 ${threadFocusActive ? 'hidden md:block' : ''}`}
                style={activeTab ? { flexBasis: `${splitRatio * 100}%` } : undefined}
            >
                <ChatRoom roomId={roomId} userId={userId} />
            </div>

            {activeTab && (
                <>
                    <div
                        onPointerDown={handleDividerPointerDown}
                        className={`bg-surface-200 dark:bg-surface-700 md:w-1 md:cursor-col-resize md:mx-0 h-1 w-full cursor-row-resize ${threadFocusActive || talkFocusActive ? 'hidden md:block' : ''}`}
                        role="separator"
                        aria-label="分割リサイズ"
                    />
                    <div
                        className={`flex-1 min-w-0 min-h-0 border-t md:border-t-0 md:border-l border-surface-200 dark:border-surface-800 ${talkFocusActive ? 'hidden md:block' : ''}`}
                        style={{ flexBasis: `${(1 - splitRatio) * 100}%` }}
                    >
                        <div className="flex items-center gap-2 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-2 overflow-auto">
                            {tabs.map((tab) => (
                                <div
                                    key={tab.tabId}
                                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${tab.tabId === activeTab.tabId
                                        ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                                        : 'border-surface-200 dark:border-surface-700 text-surface-500'
                                        }`}
                                >
                                    <button
                                        onClick={() => setActiveTab(tab.tabId)}
                                        className="truncate max-w-[120px]"
                                    >
                                        {tab.title}
                                    </button>
                                    <button
                                        onClick={() => removeTab(tab.tabId)}
                                        className="text-surface-400 hover:text-error-500"
                                        aria-label="タブを閉じる"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 min-h-0 h-[calc(100%-40px)]">
                            <AIThreadPanel threadId={activeTab.threadId} variant="embedded" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
