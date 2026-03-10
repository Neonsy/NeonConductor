import { describe, expect, it, vi } from 'vitest';

import {
    prefetchWorkspaceBootData,
    resetWorkspaceBootPrefetchForTests,
    startWorkspaceBootPrefetch,
} from '@/web/components/runtime/workspaceBootLoader';

describe('workspaceBootLoader', () => {
    it('starts boot prefetch only once while an app boot prefetch is already in flight', async () => {
        resetWorkspaceBootPrefetchForTests();

        let resolveProfileList: ((value: { profiles: Array<{ id: string; isActive: boolean }> }) => void) | undefined;
        const profileListEnsureData = vi.fn().mockImplementation(
            () =>
                new Promise<{ profiles: Array<{ id: string; isActive: boolean }> }>((resolve) => {
                    resolveProfileList = resolve;
                })
        );
        const activeProfileEnsureData = vi.fn().mockResolvedValue({
            activeProfileId: 'profile_default',
        });
        const modeListPrefetch = vi.fn().mockResolvedValue(undefined);
        const modeActivePrefetch = vi.fn().mockResolvedValue(undefined);
        const shellBootstrapPrefetch = vi.fn().mockResolvedValue(undefined);

        const firstPrefetchPromise = startWorkspaceBootPrefetch({
            trpcUtils: {
                profile: {
                    list: {
                        ensureData: profileListEnsureData,
                    },
                    getActive: {
                        ensureData: activeProfileEnsureData,
                    },
                },
                mode: {
                    list: {
                        prefetch: modeListPrefetch,
                    },
                    getActive: {
                        prefetch: modeActivePrefetch,
                    },
                },
                runtime: {
                    getShellBootstrap: {
                        prefetch: shellBootstrapPrefetch,
                    },
                },
            },
        });
        const secondPrefetchPromise = startWorkspaceBootPrefetch({
            trpcUtils: {
                profile: {
                    list: {
                        ensureData: profileListEnsureData,
                    },
                    getActive: {
                        ensureData: activeProfileEnsureData,
                    },
                },
                mode: {
                    list: {
                        prefetch: modeListPrefetch,
                    },
                    getActive: {
                        prefetch: modeActivePrefetch,
                    },
                },
                runtime: {
                    getShellBootstrap: {
                        prefetch: shellBootstrapPrefetch,
                    },
                },
            },
        });

        expect(firstPrefetchPromise).toBe(secondPrefetchPromise);
        expect(profileListEnsureData).toHaveBeenCalledTimes(1);
        expect(activeProfileEnsureData).toHaveBeenCalledTimes(1);

        resolveProfileList?.({
            profiles: [
                {
                    id: 'profile_default',
                    isActive: true,
                },
            ],
        });
        await Promise.all([firstPrefetchPromise, secondPrefetchPromise]);
        expect(modeListPrefetch).toHaveBeenCalledTimes(1);
        expect(modeActivePrefetch).toHaveBeenCalledTimes(1);
        expect(shellBootstrapPrefetch).toHaveBeenCalledTimes(1);
    });

    it('prefetches chat boot data for the resolved active profile', async () => {
        resetWorkspaceBootPrefetchForTests();

        const profileListEnsureData = vi.fn().mockResolvedValue({
            profiles: [
                {
                    id: 'profile_default',
                    isActive: true,
                },
            ],
        });
        const activeProfileEnsureData = vi.fn().mockResolvedValue({
            activeProfileId: 'profile_default',
        });
        const modeListPrefetch = vi.fn().mockResolvedValue(undefined);
        const modeActivePrefetch = vi.fn().mockResolvedValue(undefined);
        const shellBootstrapPrefetch = vi.fn().mockResolvedValue(undefined);

        await prefetchWorkspaceBootData({
            trpcUtils: {
                profile: {
                    list: {
                        ensureData: profileListEnsureData,
                    },
                    getActive: {
                        ensureData: activeProfileEnsureData,
                    },
                },
                mode: {
                    list: {
                        prefetch: modeListPrefetch,
                    },
                    getActive: {
                        prefetch: modeActivePrefetch,
                    },
                },
                runtime: {
                    getShellBootstrap: {
                        prefetch: shellBootstrapPrefetch,
                    },
                },
            },
        });

        expect(profileListEnsureData).toHaveBeenCalledOnce();
        expect(activeProfileEnsureData).toHaveBeenCalledOnce();
        expect(modeListPrefetch).toHaveBeenCalledWith(
            {
                profileId: 'profile_default',
                topLevelTab: 'chat',
            },
        );
        expect(modeActivePrefetch).toHaveBeenCalledWith(
            {
                profileId: 'profile_default',
                topLevelTab: 'chat',
            },
        );
        expect(shellBootstrapPrefetch).toHaveBeenCalledWith(
            {
                profileId: 'profile_default',
            },
        );
    });

    it('stops after ensuring profile state when no profile can be resolved', async () => {
        resetWorkspaceBootPrefetchForTests();

        const modeListPrefetch = vi.fn().mockResolvedValue(undefined);
        const modeActivePrefetch = vi.fn().mockResolvedValue(undefined);
        const shellBootstrapPrefetch = vi.fn().mockResolvedValue(undefined);

        await prefetchWorkspaceBootData({
            trpcUtils: {
                profile: {
                    list: {
                        ensureData: vi.fn().mockResolvedValue({
                            profiles: [],
                        }),
                    },
                    getActive: {
                        ensureData: vi.fn().mockResolvedValue({
                            activeProfileId: undefined,
                        }),
                    },
                },
                mode: {
                    list: {
                        prefetch: modeListPrefetch,
                    },
                    getActive: {
                        prefetch: modeActivePrefetch,
                    },
                },
                runtime: {
                    getShellBootstrap: {
                        prefetch: shellBootstrapPrefetch,
                    },
                },
            },
        });

        expect(modeListPrefetch).not.toHaveBeenCalled();
        expect(modeActivePrefetch).not.toHaveBeenCalled();
        expect(shellBootstrapPrefetch).not.toHaveBeenCalled();
    });
});
