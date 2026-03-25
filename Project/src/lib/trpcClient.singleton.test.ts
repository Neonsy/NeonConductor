import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcLinkSpy = vi.fn(() => 'ipc-link');
const createClientSpy = vi.fn(() => ({
    runtime: {
        subscribeEvents: {
            subscribe: vi.fn(),
        },
    },
}));

vi.mock('electron-trpc-experimental/renderer', () => ({
    ipcLink: ipcLinkSpy,
}));

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        createClient: createClientSpy,
    },
}));

describe('trpc client singleton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('reuses one renderer client across the raw and react-query entrypoints', async () => {
        const rawClientModule = await import('@/web/lib/trpcClient');
        const coreModule = await import('@/web/lib/providers/trpcCore');

        expect(createClientSpy).toHaveBeenCalledTimes(1);
        expect(ipcLinkSpy).toHaveBeenCalledTimes(1);
        expect(coreModule.trpcClient).toBe(rawClientModule.trpcClient);
    });
});
