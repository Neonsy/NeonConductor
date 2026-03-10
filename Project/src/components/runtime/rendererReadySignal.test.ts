import { beforeEach, describe, expect, it, vi } from 'vitest';

const signalReadyMutationSpy = vi.fn(() => Promise.resolve());

vi.mock('@/web/lib/trpcClient', () => ({
    trpcClient: {
        system: {
            signalReady: {
                mutate: signalReadyMutationSpy,
            },
        },
    },
}));

describe('rendererReadySignal', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { resetRendererReadySignalForTests } = await import('@/web/components/runtime/rendererReadySignal');
        resetRendererReadySignalForTests();
    });

    it('sends the ready signal only once when called repeatedly', async () => {
        const { sendRendererReadySignal } = await import('@/web/components/runtime/rendererReadySignal');

        await sendRendererReadySignal();
        await sendRendererReadySignal();

        expect(signalReadyMutationSpy).toHaveBeenCalledTimes(1);
    });

    it('resets to idle when the ready signal fails', async () => {
        const expectedError = new Error('boot failed');
        signalReadyMutationSpy.mockRejectedValueOnce(expectedError);
        const { sendRendererReadySignal } = await import('@/web/components/runtime/rendererReadySignal');

        await expect(sendRendererReadySignal()).rejects.toThrow('boot failed');
        expect(signalReadyMutationSpy).toHaveBeenCalledTimes(1);

        signalReadyMutationSpy.mockResolvedValueOnce(undefined);
        await sendRendererReadySignal();
        expect(signalReadyMutationSpy).toHaveBeenCalledTimes(2);
    });
});
