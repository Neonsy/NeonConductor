import { describe, expect, it, vi } from 'vitest';

import { prefetchSettingsData } from '@/web/components/settings/settingsPrefetch';

describe('settingsPrefetch', () => {
    it('warms the default settings surfaces without blocking on the result', async () => {
        const listProvidersPrefetch = vi.fn().mockResolvedValue(undefined);
        const defaultsPrefetch = vi.fn().mockResolvedValue(undefined);
        const profileListPrefetch = vi.fn().mockResolvedValue(undefined);
        const globalSettingsPrefetch = vi.fn().mockResolvedValue(undefined);
        const profileSettingsPrefetch = vi.fn().mockResolvedValue(undefined);
        const listWorkspaceRootsPrefetch = vi.fn().mockResolvedValue(undefined);
        const registryPrefetch = vi.fn().mockResolvedValue(undefined);

        prefetchSettingsData({
            profileId: 'profile_default',
            trpcUtils: {
                provider: {
                    listProviders: {
                        prefetch: listProvidersPrefetch,
                    },
                    getDefaults: {
                        prefetch: defaultsPrefetch,
                    },
                },
                profile: {
                    list: {
                        prefetch: profileListPrefetch,
                    },
                },
                context: {
                    getGlobalSettings: {
                        prefetch: globalSettingsPrefetch,
                    },
                    getProfileSettings: {
                        prefetch: profileSettingsPrefetch,
                    },
                },
                runtime: {
                    listWorkspaceRoots: {
                        prefetch: listWorkspaceRootsPrefetch,
                    },
                },
                registry: {
                    listResolved: {
                        prefetch: registryPrefetch,
                    },
                },
            },
        });

        await Promise.resolve();

        expect(listProvidersPrefetch).toHaveBeenCalledOnce();
        expect(defaultsPrefetch).toHaveBeenCalledOnce();
        expect(profileListPrefetch).toHaveBeenCalledOnce();
        expect(globalSettingsPrefetch).toHaveBeenCalledOnce();
        expect(profileSettingsPrefetch).toHaveBeenCalledWith(
            {
                profileId: 'profile_default',
            },
        );
        expect(listWorkspaceRootsPrefetch).toHaveBeenCalledOnce();
        expect(registryPrefetch).toHaveBeenCalledOnce();
    });
});
