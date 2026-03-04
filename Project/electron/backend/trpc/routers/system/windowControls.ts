import type { BrowserWindow } from 'electron';

export type WindowState = {
    isMaximized: boolean;
    isFullScreen: boolean;
    canMaximize: boolean;
    canMinimize: boolean;
    platform: NodeJS.Platform;
};

export interface WindowStateEvent {
    sequence: number;
    state: WindowState;
}

type WindowStateListener = (event: WindowStateEvent) => void;

const MAX_WINDOW_STATE_EVENTS = 100;

let windowStateSequence = 0;
const windowStateListeners = new Set<WindowStateListener>();
const windowStateEvents: WindowStateEvent[] = [];
const registeredWindowIds = new Set<number>();

function emitWindowState(win: BrowserWindow | null): void {
    const event: WindowStateEvent = {
        sequence: ++windowStateSequence,
        state: getWindowState(win),
    };

    windowStateEvents.push(event);
    if (windowStateEvents.length > MAX_WINDOW_STATE_EVENTS) {
        windowStateEvents.shift();
    }

    for (const listener of windowStateListeners) {
        listener(event);
    }
}

export function listWindowStateEvents(afterSequence?: number): WindowStateEvent[] {
    const cursor = afterSequence ?? 0;
    return windowStateEvents.filter((event) => event.sequence > cursor);
}

export function subscribeWindowState(listener: WindowStateListener): () => void {
    windowStateListeners.add(listener);
    return () => {
        windowStateListeners.delete(listener);
    };
}

export function registerWindowStateBridge(win: BrowserWindow): void {
    if (registeredWindowIds.has(win.id)) {
        return;
    }

    registeredWindowIds.add(win.id);

    const publish = () => {
        emitWindowState(win);
    };

    win.on('maximize', publish);
    win.on('unmaximize', publish);
    win.on('enter-full-screen', publish);
    win.on('leave-full-screen', publish);
    win.on('minimize', publish);
    win.on('restore', publish);
    win.on('focus', publish);
    win.on('blur', publish);
    win.on('resized', publish);

    win.on('closed', () => {
        registeredWindowIds.delete(win.id);
    });

    publish();
}

export function getWindowState(win: BrowserWindow | null): WindowState {
    return {
        isMaximized: Boolean(win?.isMaximized()),
        isFullScreen: Boolean(win?.isFullScreen()),
        canMaximize: Boolean(win?.isMaximizable()),
        canMinimize: Boolean(win?.isMinimizable()),
        platform: process.platform,
    };
}

export function minimizeWindow(win: BrowserWindow | null): { success: boolean } {
    if (!win) return { success: false };
    if (!win.isMinimizable()) return { success: false };
    win.minimize();
    emitWindowState(win);
    return { success: true };
}

export function toggleMaximizeWindow(win: BrowserWindow | null): {
    success: boolean;
    isMaximized: boolean;
    isFullScreen: boolean;
} {
    if (!win) return { success: false, isMaximized: false, isFullScreen: false };

    if (win.isFullScreen()) {
        win.setFullScreen(false);
        emitWindowState(win);
        return { success: true, isMaximized: win.isMaximized(), isFullScreen: false };
    }

    if (win.isMaximized()) {
        win.unmaximize();
    } else if (win.isMaximizable()) {
        win.maximize();
    }

    emitWindowState(win);
    return { success: true, isMaximized: win.isMaximized(), isFullScreen: win.isFullScreen() };
}

export function closeWindow(win: BrowserWindow | null): { success: boolean } {
    if (!win) return { success: false };
    win.close();
    return { success: true };
}
