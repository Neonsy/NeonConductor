import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    appRouter,
    bootstrapMainProcessSpy,
    createContextSpy,
    handleStartupFailureSpy,
    initAutoUpdaterSpy,
    resolvePersistedUpdateChannelSpy,
} = vi.hoisted(() => {
    const appRouter = {} as never;

    return {
        appRouter,
        bootstrapMainProcessSpy: vi.fn(() => Promise.reject(new Error('bootstrap failed'))),
        createContextSpy: vi.fn(() => Promise.resolve({} as never)),
        handleStartupFailureSpy: vi.fn(() => Promise.resolve()),
        initAutoUpdaterSpy: vi.fn(),
        resolvePersistedUpdateChannelSpy: vi.fn(() => 'stable' as const),
    };
});

vi.mock('@/app/backend/trpc/context', () => ({
    createContext: createContextSpy,
}));

vi.mock('@/app/backend/trpc/router', () => ({
    appRouter,
}));

vi.mock('@/app/main/bootstrap', () => ({
    bootstrapMainProcess: bootstrapMainProcessSpy,
}));

vi.mock('@/app/main/bootstrap/startupFailure', () => ({
    handleStartupFailure: handleStartupFailureSpy,
}));

vi.mock('@/app/main/updates/updater', () => ({
    initAutoUpdater: initAutoUpdaterSpy,
    resolvePersistedUpdateChannel: resolvePersistedUpdateChannelSpy,
}));

describe('electron main entry', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('owns bootstrap rejection with the startup failure handler', async () => {
        await import('@/app/main/index');

        await Promise.resolve();
        await Promise.resolve();

        expect(bootstrapMainProcessSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                appRouter,
                createContext: createContextSpy,
                initAutoUpdater: initAutoUpdaterSpy,
                resolvePersistenceChannel: resolvePersistedUpdateChannelSpy,
            }),
            expect.stringContaining('/electron/main/index.ts')
        );
        expect(handleStartupFailureSpy).toHaveBeenCalledWith(expect.any(Error));
    });
});
