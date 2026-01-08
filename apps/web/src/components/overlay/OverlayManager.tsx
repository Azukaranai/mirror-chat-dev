'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
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
    const { closeWindow, minimizeWindow, bringToFront, updatePosition, updateSize } = useOverlayStore();
    const windowRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const initialSize = useRef({ width: 0, height: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    // Handle dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.window-controls')) return;

        bringToFront(window.windowId);
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - window.x,
            y: e.clientY - window.y,
        };
    }, [window.windowId, window.x, window.y, bringToFront]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        bringToFront(window.windowId);
        setIsResizing(true);
        initialSize.current = { width: window.width, height: window.height };
        initialPos.current = { x: e.clientX, y: e.clientY };
    }, [window.windowId, window.width, window.height, bringToFront]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = Math.max(0, e.clientX - dragOffset.current.x);
                const newY = Math.max(0, e.clientY - dragOffset.current.y);
                updatePosition(window.windowId, newX, newY);
            }
            if (isResizing) {
                const deltaX = e.clientX - initialPos.current.x;
                const deltaY = e.clientY - initialPos.current.y;
                const newWidth = Math.max(320, initialSize.current.width + deltaX);
                const newHeight = Math.max(400, initialSize.current.height + deltaY);
                updateSize(window.windowId, newWidth, newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, window.windowId, updatePosition, updateSize]);

    if (window.minimized) {
        return null;
    }

    return (
        <div
            ref={windowRef}
            className={cn(
                'overlay-window',
                isDragging && 'cursor-grabbing',
                isResizing && 'cursor-nwse-resize'
            )}
            style={{
                left: window.x,
                top: window.y,
                width: window.width,
                height: window.height,
                zIndex: window.zIndex + 300, // Add to base z-index
            }}
            onClick={() => bringToFront(window.windowId)}
        >
            {/* Header */}
            <div
                className="overlay-window-header"
                onMouseDown={handleMouseDown}
            >
                <span className="text-sm font-medium truncate flex-1">
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
            <div className="overlay-window-content p-4">
                <div className="flex items-center justify-center h-full text-surface-400">
                    <p>AIスレッド: {window.threadId}</p>
                </div>
            </div>

            {/* Resize Handle */}
            <div
                className="overlay-resize-handle"
                onMouseDown={handleResizeMouseDown}
            >
                <svg
                    className="absolute bottom-1 right-1 w-3 h-3 text-surface-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
            </div>
        </div>
    );
}

// Minimized windows bar
function MinimizedBar() {
    const { windows, restoreWindow } = useOverlayStore();
    const minimizedWindows = windows.filter((w) => w.minimized);

    if (minimizedWindows.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-surface-900/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg z-[400]">
            {minimizedWindows.map((w) => (
                <button
                    key={w.windowId}
                    onClick={() => restoreWindow(w.windowId)}
                    className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 hover:bg-surface-700 text-sm text-white transition-colors"
                >
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    AIスレッド
                </button>
            ))}
        </div>
    );
}

export function OverlayManager() {
    const { windows } = useOverlayStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <>
            {windows.map((window) => (
                <OverlayWindowComponent key={window.windowId} window={window} />
            ))}
            <MinimizedBar />
        </>,
        document.body
    );
}
