'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayStore, useCacheStore } from '@/lib/stores';
import { AIThreadPanel } from '@/components/ai/AIThreadPanel';
import { cn, isMobile } from '@/lib/utils';
import type { OverlayWindow } from '@/types';

// Icons
const MinusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface OverlayWindowComponentProps {
    window: OverlayWindow;
}

function OverlayWindowComponent({ window }: OverlayWindowComponentProps) {
    const { closeWindow, minimizeWindow, restoreWindow, bringToFront, updatePosition, updateSize } = useOverlayStore();
    const { threadCache } = useCacheStore();
    const cached = threadCache.get(window.threadId);
    const windowTitle = cached?.thread?.title || 'AIスレッド';
    const windowRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [resizingDirection, setResizingDirection] = useState<string | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const initialSize = useRef({ width: 0, height: 0 });
    const initialPos = useRef({ x: 0, y: 0 });
    const initialWindowPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    const MINIMIZED_WIDTH = 150;
    const renderX = window.minimized
        ? window.x + window.width - MINIMIZED_WIDTH
        : window.x;

    // Handle dragging
    const onDragStart = useCallback((clientX: number, clientY: number, target: EventTarget) => {
        if ((target as HTMLElement).closest('.window-controls')) return;
        if ((target as HTMLElement).closest('.resize-handle')) return;

        bringToFront(window.windowId);
        setIsDragging(true);
        hasMoved.current = false;
        dragOffset.current = {
            x: clientX - renderX,
            y: clientY - window.y,
        };
    }, [window.windowId, window.x, window.y, window.width, window.minimized, renderX, bringToFront]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        onDragStart(e.clientX, e.clientY, e.target);
    }, [onDragStart]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        onDragStart(touch.clientX, touch.clientY, e.target);
    }, [onDragStart]);

    const startResize = useCallback((direction: string) => (e: React.MouseEvent) => {
        e.stopPropagation();
        bringToFront(window.windowId);
        setResizingDirection(direction);
        initialSize.current = { width: window.width, height: window.height };
        initialPos.current = { x: e.clientX, y: e.clientY };
        initialWindowPos.current = { x: window.x, y: window.y };
    }, [window.windowId, window.width, window.height, window.x, window.y, bringToFront]);

    useEffect(() => {
        const handleDrag = (clientX: number, clientY: number) => {
            if (isDragging) {
                hasMoved.current = true;
                const newRenderX = Math.max(0, clientX - dragOffset.current.x);
                const newY = Math.max(0, clientY - dragOffset.current.y);

                const newStoreX = window.minimized
                    ? newRenderX - window.width + MINIMIZED_WIDTH
                    : newRenderX;

                updatePosition(window.windowId, newStoreX, newY);
            }
            if (resizingDirection) {
                const deltaX = clientX - initialPos.current.x;
                const deltaY = clientY - initialPos.current.y;

                let newWidth = initialSize.current.width;
                let newHeight = initialSize.current.height;
                let newX = initialWindowPos.current.x;
                let newY = initialWindowPos.current.y;

                // Calculate dimensions
                if (resizingDirection.includes('e')) {
                    newWidth = initialSize.current.width + deltaX;
                }
                if (resizingDirection.includes('w')) {
                    newWidth = initialSize.current.width - deltaX;
                }
                if (resizingDirection.includes('s')) {
                    newHeight = initialSize.current.height + deltaY;
                }
                if (resizingDirection.includes('n')) {
                    newHeight = initialSize.current.height - deltaY;
                }

                // Apply constraints
                const minWidth = 320;
                const minHeight = 400;

                if (newWidth < minWidth) newWidth = minWidth;
                if (newHeight < minHeight) newHeight = minHeight;

                // Calculate position adjustments for left/top resizing
                if (resizingDirection.includes('w')) {
                    newX = initialWindowPos.current.x + (initialSize.current.width - newWidth);
                }
                if (resizingDirection.includes('n')) {
                    newY = initialWindowPos.current.y + (initialSize.current.height - newHeight);
                }

                updateSize(window.windowId, newWidth, newHeight);
                if (resizingDirection.includes('w') || resizingDirection.includes('n')) {
                    updatePosition(window.windowId, newX, newY);
                }
            }
        };

        const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            if (isDragging || resizingDirection) e.preventDefault();
            const touch = e.touches[0];
            handleDrag(touch.clientX, touch.clientY);
        };

        const handleEnd = () => {
            setIsDragging(false);
            setResizingDirection(null);
        };

        if (isDragging || resizingDirection) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleEnd);
            // Block text selection while resizing/dragging
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
            document.body.style.userSelect = '';
        };
    }, [isDragging, resizingDirection, window.windowId, updatePosition, updateSize]);

    if (window.minimized) {
        return (
            <div
                className={cn(
                    'fixed z-[400] cursor-pointer flex items-center gap-2 px-4 py-2 rounded-full shadow-xl transition-colors transition-transform',
                    'bg-surface-900/90 text-white backdrop-blur-md border border-surface-700/50',
                    'hover:bg-surface-800 hover:scale-105 active:scale-95',
                    isDragging && 'cursor-grabbing scale-105'
                )}
                style={{
                    left: renderX,
                    top: window.y,
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => {
                    if (!hasMoved.current) {
                        restoreWindow(window.windowId);
                    }
                }}
            >
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span className="text-sm font-medium select-none">{windowTitle}</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        closeWindow(window.windowId);
                    }}
                    className="ml-1 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                    <XMarkIcon className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={windowRef}
            className={cn(
                'overlay-window',
                isDragging && 'cursor-grabbing',
            )}
            style={{
                left: renderX,
                top: window.y,
                width: window.width,
                height: window.height,
                zIndex: window.zIndex + 300,
            }}
            onClick={() => bringToFront(window.windowId)}
        >
            {/* Header */}
            <div
                className="overlay-window-header"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <span className="text-sm font-medium truncate flex-1 select-none">
                    AIスレッド
                </span>
                <div className="window-controls flex items-center gap-1">
                    <button
                        onClick={() => minimizeWindow(window.windowId)}
                        className="btn-icon p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700"
                    >
                        <MinusIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => closeWindow(window.windowId)}
                        className="btn-icon p-1.5 hover:bg-error-500/10 hover:text-error-500"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="overlay-window-content p-0">
                <AIThreadPanel threadId={window.threadId} variant="embedded" />
            </div>

            {/* Resize Handles */}
            <div className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 hover:bg-primary-500/20 rounded-tl-lg" onMouseDown={startResize('nw')} />
            <div className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50 hover:bg-primary-500/20 rounded-tr-lg" onMouseDown={startResize('ne')} />
            <div className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50 hover:bg-primary-500/20 rounded-bl-lg" onMouseDown={startResize('sw')} />
            <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 hover:bg-primary-500/20 rounded-br-lg grid place-items-center" onMouseDown={startResize('se')}>
                <svg className="w-3 h-3 text-surface-400 rotate-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
            </div>
            <div className="resize-handle absolute top-0 left-4 right-4 h-2 cursor-n-resize z-40 hover:bg-primary-500/10" onMouseDown={startResize('n')} />
            <div className="resize-handle absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-40 hover:bg-primary-500/10" onMouseDown={startResize('s')} />
            <div className="resize-handle absolute left-0 top-4 bottom-4 w-2 cursor-w-resize z-40 hover:bg-primary-500/10" onMouseDown={startResize('w')} />
            <div className="resize-handle absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-40 hover:bg-primary-500/10" onMouseDown={startResize('e')} />
        </div>
    );
}

export function OverlayManager() {
    const { windows } = useOverlayStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isMobile()) {
            const state = useOverlayStore.getState();
            state.windows.forEach((w) => {
                if (!w.minimized) {
                    state.minimizeWindow(w.windowId);
                }
            });
        }
    }, []);

    if (!mounted) return null;

    return createPortal(
        <>
            {windows.map((window) => (
                <OverlayWindowComponent key={window.windowId} window={window} />
            ))}
        </>,
        document.body
    );
}
