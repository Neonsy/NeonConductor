import { Menu, screen } from 'electron';

import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

export type WindowState = {
    isMaximized: boolean;
    isFullScreen: boolean;
    canMaximize: boolean;
    canMinimize: boolean;
    platform: NodeJS.Platform;
};

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
        return { success: true, isMaximized: win.isMaximized(), isFullScreen: false };
    }

    if (win.isMaximized()) {
        win.unmaximize();
    } else if (win.isMaximizable()) {
        win.maximize();
    }

    return { success: true, isMaximized: win.isMaximized(), isFullScreen: win.isFullScreen() };
}

export function closeWindow(win: BrowserWindow | null): { success: boolean } {
    if (!win) return { success: false };
    win.close();
    return { success: true };
}

export function showWindowMenu(win: BrowserWindow | null): { success: boolean } {
    if (!win) return { success: false };

    const state = getWindowState(win);

    const template: MenuItemConstructorOptions[] = [
        {
            label: state.isFullScreen ? 'Exit Full Screen' : 'Restore',
            enabled: state.isMaximized || state.isFullScreen,
            click: () => {
                if (win.isFullScreen()) {
                    win.setFullScreen(false);
                } else if (win.isMaximized()) {
                    win.unmaximize();
                }
            },
        },
        {
            label: 'Minimize',
            enabled: state.canMinimize,
            click: () => {
                win.minimize();
            },
        },
        {
            label: 'Maximize',
            enabled: state.canMaximize && !state.isMaximized && !state.isFullScreen,
            click: () => {
                win.maximize();
            },
        },
        { type: 'separator' },
        {
            label: 'Close',
            click: () => {
                win.close();
            },
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const x = Math.max(0, cursor.x - bounds.x);
    const y = Math.max(0, cursor.y - bounds.y);

    menu.popup({ window: win, x, y });
    return { success: true };
}
