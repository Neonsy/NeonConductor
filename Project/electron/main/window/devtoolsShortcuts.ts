import type { BrowserWindow, Input } from 'electron';

export function isDevToolsShortcut(input: Input): boolean {
    const key = input.code;

    if (key === 'F12') {
        return true;
    }

    const isWinLinuxDevTools = input.control && input.shift && !input.meta && !input.alt && key === 'KeyI';
    const isMacDevTools = input.meta && input.alt && !input.control && !input.shift && key === 'KeyI';
    const isMacAltLayoutFallback = input.meta && input.shift && !input.control && !input.alt && key === 'KeyI';

    return isWinLinuxDevTools || isMacDevTools || isMacAltLayoutFallback;
}

export function attachDevelopmentShortcuts(win: BrowserWindow, isDev: boolean): void {
    if (!isDev) {
        return;
    }

    win.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown' || input.isAutoRepeat) {
            return;
        }

        if (!isDevToolsShortcut(input)) {
            return;
        }

        event.preventDefault();
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools({ mode: 'detach' });
        }
    });
}
