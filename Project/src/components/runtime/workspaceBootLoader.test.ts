import { describe, expect, it, vi } from 'vitest';

import { prefetchWorkspaceBootData } from '@/web/components/runtime/workspaceBootLoader';

describe('workspaceBootLoader', () => {
    it('prefetches chat boot data for the resolved active profile', async () => {
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
