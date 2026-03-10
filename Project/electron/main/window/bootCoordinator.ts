import { app, type BrowserWindow } from 'electron';

export const BOOT_SPLASH_DELAY_MS = 3000;

interface BootWindowState {
    mainWindow: BrowserWindow | null;
    splashWindow: BrowserWindow | null;
    delayedSplashCallback: (() => void) | null;
    delayedTimer: ReturnType<typeof setTimeout> | null;
    handoffCompleted: boolean;
}

const bootWindowState: BootWindowState = {
    mainWindow: null,
    splashWindow: null,
    delayedSplashCallback: null,
    delayedTimer: null,
    handoffCompleted: false,
};

function clearDelayedTimer(): void {
    if (!bootWindowState.delayedTimer) {
        return;
    }

    clearTimeout(bootWindowState.delayedTimer);
    bootWindowState.delayedTimer = null;
}

function resetBootWindowState(): void {
    clearDelayedTimer();
    bootWindowState.mainWindow = null;
    bootWindowState.splashWindow = null;
    bootWindowState.delayedSplashCallback = null;
    bootWindowState.handoffCompleted = false;
}

function isSameWindow(left: BrowserWindow | null, right: BrowserWindow | null): boolean {
    if (!left || !right) {
        return false;
    }

    return left.id === right.id;
}

export function registerBootWindows(input: {
    mainWindow: BrowserWindow;
    splashWindow: BrowserWindow;
    onDelayedSplash: () => void;
    delayMs?: number;
}): void {
    clearDelayedTimer();
    bootWindowState.mainWindow = input.mainWindow;
    bootWindowState.splashWindow = input.splashWindow;
    bootWindowState.delayedSplashCallback = input.onDelayedSplash;
    bootWindowState.handoffCompleted = false;

    input.splashWindow.once('closed', () => {
        if (bootWindowState.handoffCompleted) {
            resetBootWindowState();
            return;
        }

        clearDelayedTimer();

        if (bootWindowState.mainWindow && !bootWindowState.mainWindow.isDestroyed()) {
            bootWindowState.mainWindow.close();
        }

        resetBootWindowState();
        app.quit();
    });

    bootWindowState.delayedTimer = setTimeout(() => {
        if (bootWindowState.handoffCompleted) {
            return;
        }
        if (!bootWindowState.splashWindow || bootWindowState.splashWindow.isDestroyed()) {
            return;
        }

        bootWindowState.delayedSplashCallback?.();
    }, input.delayMs ?? BOOT_SPLASH_DELAY_MS);
}

export function completeBootWindowHandoff(window: BrowserWindow | null): { success: boolean } {
    if (!window) {
        return { success: false };
    }

    if (bootWindowState.mainWindow && !isSameWindow(window, bootWindowState.mainWindow)) {
        return { success: false };
    }

    if (bootWindowState.handoffCompleted) {
        return { success: true };
    }

    bootWindowState.handoffCompleted = true;
    clearDelayedTimer();

    if (bootWindowState.splashWindow && !bootWindowState.splashWindow.isDestroyed()) {
        bootWindowState.splashWindow.close();
    }

    if (!window.isVisible()) {
        window.show();
    }
    if (!window.isMaximized()) {
        window.maximize();
    }

    bootWindowState.splashWindow = null;
    bootWindowState.delayedSplashCallback = null;

    return { success: true };
}

export function resetBootWindowStateForTests(): void {
    resetBootWindowState();
}
