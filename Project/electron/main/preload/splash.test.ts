import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BootStatusSnapshot } from '@/app/shared/splashContract';

const {
    exposeInMainWorldSpy,
    ipcOnSpy,
    ipcPhaseHandlerState,
} = vi.hoisted(() => ({
    exposeInMainWorldSpy: vi.fn(),
    ipcOnSpy: vi.fn(),
    ipcPhaseHandlerState: {
        handler: undefined as ((event: unknown, phase: unknown) => void) | undefined,
    },
}));

vi.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: exposeInMainWorldSpy,
    },
    ipcRenderer: {
        on: (channel: string, handler: (event: unknown, phase: unknown) => void) => {
            ipcOnSpy(channel, handler);
            ipcPhaseHandlerState.handler = handler;
        },
    },
}));

describe('splash preload bridge', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        ipcPhaseHandlerState.handler = undefined;
    });

    it('exposes an onStatusChange bridge that replays the latest boot status', async () => {
        await import('@/app/main/preload/splash');

        expect(exposeInMainWorldSpy).toHaveBeenCalledTimes(1);
        const splashBridge = exposeInMainWorldSpy.mock.calls[0]?.[1] as {
            onStatusChange: (listener: (status: BootStatusSnapshot) => void) => () => void;
        };

        const statusListener = vi.fn();
        splashBridge.onStatusChange(statusListener);

        expect(statusListener).toHaveBeenCalledWith(
            expect.objectContaining({
                stage: 'main_initializing',
            })
        );

        ipcPhaseHandlerState.handler?.({}, {
            stage: 'profile_resolving',
            headline: 'Resolving the active profile',
            detail: 'Resolving the active workspace profile.',
            isStuck: false,
            blockingPrerequisite: 'resolved_profile',
            elapsedMs: 100,
            source: 'renderer',
        });

        expect(statusListener).toHaveBeenLastCalledWith(
            expect.objectContaining({
                stage: 'profile_resolving',
                blockingPrerequisite: 'resolved_profile',
            })
        );
    });
});
