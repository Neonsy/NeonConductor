/**
 * Signals that the renderer is ready and shows the window.
 * Called after React has rendered to prevent blank flash.
 */

import type { BrowserWindow } from 'electron';

export function signalReady(win: BrowserWindow | null): { success: boolean } {
    if (!win) {
        return { success: false };
    }

    // Maximize and show the window now that content is ready
    if (!win.isVisible()) {
        win.show();
    }
    if (!win.isMaximized()) {
        win.maximize();
    }

    return { success: true };
}
