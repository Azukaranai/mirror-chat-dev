export * from './database';

// UI State Types
export interface OverlayWindow {
    windowId: string;
    threadId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    minimized: boolean;
}

export interface SplitTab {
    tabId: string;
    threadId: string;
    title: string;
}

// Navigation
export type NavItem = 'profile' | 'talk' | 'ai' | 'settings';

// Theme
export type Theme = 'light' | 'dark' | 'system';

// Font Scale
export type FontScale = 0.8 | 0.9 | 1 | 1.1 | 1.2;

// User Settings
export interface UserSettings {
    theme: Theme;
    fontScale: FontScale;
    notifications: boolean;
}

// Typing Indicator
export interface TypingUser {
    userId: string;
    displayName: string;
    timestamp: number;
}

// Realtime Payloads
export interface TypingPayload {
    userId: string;
    isTyping: boolean;
    timestamp: number;
    displayName?: string;
}

// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
}

export interface KeySetResponse {
    ok: boolean;
    last4: string;
}

export interface AISendMessageResponse {
    started?: boolean;
    queued?: boolean;
    runId?: string;
}

export interface AIDuplicateThreadResponse {
    newThreadId: string;
}
