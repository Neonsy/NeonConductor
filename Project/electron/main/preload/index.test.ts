import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exposeElectronTRPCSpy } = vi.hoisted(() => ({
    exposeElectronTRPCSpy: vi.fn(),
}));

vi.mock('electron-trpc-experimental/preload', () => ({
    exposeElectronTRPC: exposeElectronTRPCSpy,
}));

describe('main preload bridge', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('registers the loaded hook and exposes the Electron tRPC bridge when preload finishes booting', async () => {
        const processOnceSpy = vi.spyOn(process, 'once');

        try {
            await import('@/app/main/preload/index');

            expect(processOnceSpy).toHaveBeenCalledWith('loaded', expect.any(Function));

            const loadedHandler = processOnceSpy.mock.calls.find((call) => call[0] === 'loaded')?.[1];
            expect(loadedHandler).toBeTypeOf('function');

            loadedHandler?.call(process);

            expect(exposeElectronTRPCSpy).toHaveBeenCalledTimes(1);
        } finally {
            processOnceSpy.mockRestore();
        }
    });
});
