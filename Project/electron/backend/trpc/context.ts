/**
 * tRPC request context factory.
 * Provides per-request data (e.g., sender ID, window reference) to all procedures.
 */

import { BrowserWindow } from 'electron';

import type { CreateContextOptions } from 'electron-trpc-experimental/main';

export interface Context {
    // Identifies which renderer window sent the request (for multi-window apps)
    senderId: number;

    // Reference to the BrowserWindow that sent the request
    win: BrowserWindow | null;
}

export function createContext(opts: CreateContextOptions): Promise<Context> {
    return Promise.resolve({
        senderId: opts.event.sender.id,
        win: BrowserWindow.fromWebContents(opts.event.sender),
    });
}
