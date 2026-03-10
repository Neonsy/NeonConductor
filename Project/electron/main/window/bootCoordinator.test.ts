import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    BOOT_SPLASH_DELAY_MS,
    completeBootWindowHandoff,
    registerBootWindows,
    resetBootWindowStateForTests,
} from '@/app/main/window/bootCoordinator';

function createMockWindow(id: number) {
    const windowState = {
        visible: false,
        maximized: false,
        destroyed: false,
    };

    return {
        id,
        close: vi.fn(() => {
            windowState.destroyed = true;
        }),
        isDestroyed: vi.fn(() => windowState.destroyed),
        isMaximized: vi.fn(() => windowState.maximized),
        isVisible: vi.fn(() => windowState.visible),
        maximize: vi.fn(() => {
            windowState.maximized = true;
        }),
        show: vi.fn(() => {
            windowState.visible = true;
        }),
    };
}

describe('bootCoordinator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetBootWindowStateForTests();
    });

    it('keeps the main window hidden and transitions the splash after the delay', () => {
        const mainWindow = createMockWindow(1);
        const splashWindow = createMockWindow(2);
        const delayedSplashSpy = vi.fn();

        registerBootWindows({
            mainWindow: mainWindow as never,
            splashWindow: splashWindow as never,
            onDelayedSplash: delayedSplashSpy,
        });

        vi.advanceTimersByTime(BOOT_SPLASH_DELAY_MS - 1);
        expect(delayedSplashSpy).not.toHaveBeenCalled();
        expect(mainWindow.show).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(delayedSplashSpy).toHaveBeenCalledTimes(1);
        expect(mainWindow.show).not.toHaveBeenCalled();
    });

    it('closes the splash and shows the main window exactly once when handoff completes', () => {
        const mainWindow = createMockWindow(10);
        const splashWindow = createMockWindow(20);

        registerBootWindows({
            mainWindow: mainWindow as never,
            splashWindow: splashWindow as never,
            onDelayedSplash: vi.fn(),
        });

        expect(completeBootWindowHandoff(mainWindow as never)).toEqual({ success: true });
        expect(splashWindow.close).toHaveBeenCalledTimes(1);
        expect(mainWindow.show).toHaveBeenCalledTimes(1);
        expect(mainWindow.maximize).toHaveBeenCalledTimes(1);

        expect(completeBootWindowHandoff(mainWindow as never)).toEqual({ success: true });
        expect(splashWindow.close).toHaveBeenCalledTimes(1);
        expect(mainWindow.show).toHaveBeenCalledTimes(1);
        expect(mainWindow.maximize).toHaveBeenCalledTimes(1);
    });

    it('rejects handoff requests from a different window', () => {
        const mainWindow = createMockWindow(100);
        const splashWindow = createMockWindow(200);
        const otherWindow = createMockWindow(300);

        registerBootWindows({
            mainWindow: mainWindow as never,
            splashWindow: splashWindow as never,
            onDelayedSplash: vi.fn(),
        });

        expect(completeBootWindowHandoff(otherWindow as never)).toEqual({ success: false });
        expect(splashWindow.close).not.toHaveBeenCalled();
        expect(mainWindow.show).not.toHaveBeenCalled();
    });
});
