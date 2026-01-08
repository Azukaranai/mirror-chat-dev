import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme, FontScale, UserSettings, NavItem, OverlayWindow, SplitTab } from '@/types';

// ============================================
// Auth Store
// ============================================

interface AuthState {
    userId: string | null;
    isLoading: boolean;
    setUserId: (userId: string | null) => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    userId: null,
    isLoading: true,
    setUserId: (userId) => set({ userId }),
    setLoading: (isLoading) => set({ isLoading }),
}));

// ============================================
// UI Store (Persisted)
// ============================================

interface UIState {
    // Theme
    theme: Theme;
    setTheme: (theme: Theme) => void;

    // Font Scale
    fontScale: FontScale;
    setFontScale: (scale: FontScale) => void;

    // Navigation
    activeNav: NavItem;
    setActiveNav: (nav: NavItem) => void;

    // Mobile sidebar
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Theme
            theme: 'system',
            setTheme: (theme) => set({ theme }),

            // Font Scale - Mobile default is smaller
            fontScale: 1,
            setFontScale: (fontScale) => set({ fontScale }),

            // Navigation
            activeNav: 'talk',
            setActiveNav: (activeNav) => set({ activeNav }),

            // Sidebar
            sidebarOpen: false,
            setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                theme: state.theme,
                fontScale: state.fontScale,
            }),
        }
    )
);

// ============================================
// Overlay Store (Persisted)
// ============================================

interface OverlayState {
    windows: OverlayWindow[];
    nextZIndex: number;

    // Actions
    openWindow: (threadId: string) => string; // Returns windowId
    closeWindow: (windowId: string) => void;
    minimizeWindow: (windowId: string) => void;
    restoreWindow: (windowId: string) => void;
    bringToFront: (windowId: string) => void;
    updatePosition: (windowId: string, x: number, y: number) => void;
    updateSize: (windowId: string, width: number, height: number) => void;
}

const generateWindowId = () => `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_WINDOW_SIZE = { width: 480, height: 600 };
const WINDOW_OFFSET = 30; // Offset for new windows

export const useOverlayStore = create<OverlayState>()(
    persist(
        (set, get) => ({
            windows: [],
            nextZIndex: 1,

            openWindow: (threadId) => {
                const windowId = generateWindowId();
                const { windows, nextZIndex } = get();

                // Calculate position (offset from last window or center)
                const lastWindow = windows[windows.length - 1];
                const baseX = lastWindow ? lastWindow.x + WINDOW_OFFSET : 100;
                const baseY = lastWindow ? lastWindow.y + WINDOW_OFFSET : 100;

                const newWindow: OverlayWindow = {
                    windowId,
                    threadId,
                    x: baseX,
                    y: baseY,
                    width: DEFAULT_WINDOW_SIZE.width,
                    height: DEFAULT_WINDOW_SIZE.height,
                    zIndex: nextZIndex,
                    minimized: false,
                };

                set({
                    windows: [...windows, newWindow],
                    nextZIndex: nextZIndex + 1,
                });

                return windowId;
            },

            closeWindow: (windowId) => {
                set((state) => ({
                    windows: state.windows.filter((w) => w.windowId !== windowId),
                }));
            },

            minimizeWindow: (windowId) => {
                set((state) => ({
                    windows: state.windows.map((w) =>
                        w.windowId === windowId ? { ...w, minimized: true } : w
                    ),
                }));
            },

            restoreWindow: (windowId) => {
                const { nextZIndex } = get();
                set((state) => ({
                    windows: state.windows.map((w) =>
                        w.windowId === windowId ? { ...w, minimized: false, zIndex: nextZIndex } : w
                    ),
                    nextZIndex: nextZIndex + 1,
                }));
            },

            bringToFront: (windowId) => {
                const { nextZIndex } = get();
                set((state) => ({
                    windows: state.windows.map((w) =>
                        w.windowId === windowId ? { ...w, zIndex: nextZIndex } : w
                    ),
                    nextZIndex: nextZIndex + 1,
                }));
            },

            updatePosition: (windowId, x, y) => {
                set((state) => ({
                    windows: state.windows.map((w) =>
                        w.windowId === windowId ? { ...w, x, y } : w
                    ),
                }));
            },

            updateSize: (windowId, width, height) => {
                set((state) => ({
                    windows: state.windows.map((w) =>
                        w.windowId === windowId ? { ...w, width, height } : w
                    ),
                }));
            },
        }),
        {
            name: 'overlay-storage',
        }
    )
);

// ============================================
// Split View Store
// ============================================

interface SplitState {
    tabs: SplitTab[];
    activeTabId: string | null;
    splitRatio: number; // 0-1, ratio of left/top panel

    // Actions
    addTab: (threadId: string, title: string) => string; // Returns tabId
    removeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    setSplitRatio: (ratio: number) => void;
}

const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useSplitStore = create<SplitState>()(
    persist(
        (set, get) => ({
            tabs: [],
            activeTabId: null,
            splitRatio: 0.5,

            addTab: (threadId, title) => {
                const tabId = generateTabId();
                const newTab: SplitTab = { tabId, threadId, title };

                set((state) => ({
                    tabs: [...state.tabs, newTab],
                    activeTabId: tabId,
                }));

                return tabId;
            },

            removeTab: (tabId) => {
                set((state) => {
                    const newTabs = state.tabs.filter((t) => t.tabId !== tabId);
                    const wasActive = state.activeTabId === tabId;

                    return {
                        tabs: newTabs,
                        activeTabId: wasActive
                            ? newTabs.length > 0
                                ? newTabs[newTabs.length - 1].tabId
                                : null
                            : state.activeTabId,
                    };
                });
            },

            setActiveTab: (activeTabId) => set({ activeTabId }),

            setSplitRatio: (splitRatio) => set({ splitRatio }),
        }),
        {
            name: 'split-storage',
        }
    )
);

// ============================================
// Chat Store (Not persisted - realtime data)
// ============================================

interface TypingIndicator {
    userId: string;
    displayName: string;
    timestamp: number;
}

interface ChatState {
    // Current room
    currentRoomId: string | null;
    setCurrentRoomId: (roomId: string | null) => void;

    // Typing indicators
    typingUsers: Map<string, TypingIndicator[]>; // roomId -> users
    setTypingUsers: (roomId: string, users: TypingIndicator[]) => void;
    addTypingUser: (roomId: string, user: TypingIndicator) => void;
    removeTypingUser: (roomId: string, userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    currentRoomId: null,
    setCurrentRoomId: (currentRoomId) => set({ currentRoomId }),

    typingUsers: new Map(),
    setTypingUsers: (roomId, users) =>
        set((state) => {
            const newMap = new Map(state.typingUsers);
            newMap.set(roomId, users);
            return { typingUsers: newMap };
        }),
    addTypingUser: (roomId, user) =>
        set((state) => {
            const newMap = new Map(state.typingUsers);
            const current = newMap.get(roomId) || [];
            const filtered = current.filter((u) => u.userId !== user.userId);
            newMap.set(roomId, [...filtered, user]);
            return { typingUsers: newMap };
        }),
    removeTypingUser: (roomId, userId) =>
        set((state) => {
            const newMap = new Map(state.typingUsers);
            const current = newMap.get(roomId) || [];
            newMap.set(roomId, current.filter((u) => u.userId !== userId));
            return { typingUsers: newMap };
        }),
}));

// ============================================
// AI Thread Store
// ============================================

interface AIState {
    currentThreadId: string | null;
    setCurrentThreadId: (threadId: string | null) => void;

    // Streaming state
    streamingContent: Map<string, string>; // threadId -> accumulated content
    setStreamingContent: (threadId: string, content: string | ((prev: string) => string)) => void;
    appendStreamingContent: (threadId: string, delta: string) => void;
    clearStreamingContent: (threadId: string) => void;

    // Run state
    runningThreads: Set<string>;
    setRunning: (threadId: string, running: boolean) => void;
    addRunningThread: (threadId: string) => void;
    removeRunningThread: (threadId: string) => void;
}

export const useAIStore = create<AIState>((set) => ({
    currentThreadId: null,
    setCurrentThreadId: (currentThreadId) => set({ currentThreadId }),

    streamingContent: new Map(),
    setStreamingContent: (threadId, content) =>
        set((state) => {
            const newMap = new Map(state.streamingContent);
            const current = newMap.get(threadId) || '';
            const newContent = typeof content === 'function' ? content(current) : content;
            newMap.set(threadId, newContent);
            return { streamingContent: newMap };
        }),
    appendStreamingContent: (threadId, delta) =>
        set((state) => {
            const newMap = new Map(state.streamingContent);
            const current = newMap.get(threadId) || '';
            newMap.set(threadId, current + delta);
            return { streamingContent: newMap };
        }),
    clearStreamingContent: (threadId) =>
        set((state) => {
            const newMap = new Map(state.streamingContent);
            newMap.delete(threadId);
            return { streamingContent: newMap };
        }),

    runningThreads: new Set(),
    setRunning: (threadId, running) =>
        set((state) => {
            const newSet = new Set(state.runningThreads);
            if (running) {
                newSet.add(threadId);
            } else {
                newSet.delete(threadId);
            }
            return { runningThreads: newSet };
        }),
    addRunningThread: (threadId) =>
        set((state) => {
            const newSet = new Set(state.runningThreads);
            newSet.add(threadId);
            return { runningThreads: newSet };
        }),
    removeRunningThread: (threadId) =>
        set((state) => {
            const newSet = new Set(state.runningThreads);
            newSet.delete(threadId);
            return { runningThreads: newSet };
        }),
}));
