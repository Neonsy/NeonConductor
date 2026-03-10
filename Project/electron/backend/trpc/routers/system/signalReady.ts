/**
 * Signals that the renderer is ready and reveals the main window.
 */

import type { BrowserWindow } from 'electron';

import { completeBootWindowHandoff } from '@/app/main/window/bootCoordinator';

export function signalReady(win: BrowserWindow | null): { success: boolean } {
    return completeBootWindowHandoff(win);
}
