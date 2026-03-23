import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';
import {
    isWarmActiveProfilePayload,
    isWarmProfileListPayload,
    resolveWarmProfileId,
} from '@/web/components/runtime/profileWarmData';
import { prefetchSettingsData } from '@/web/components/settings/settingsPrefetch';

interface SettingsRoutePrefetchInput {
    trpcUtils: Parameters<typeof prefetchSettingsData>[0]['trpcUtils'] & {
        profile: Parameters<typeof prefetchSettingsData>[0]['trpcUtils']['profile'] & {
            list: Parameters<typeof prefetchSettingsData>[0]['trpcUtils']['profile']['list'] & {
                ensureData: (
                    input: undefined,
                    options: typeof BOOT_CRITICAL_QUERY_OPTIONS
                ) => Promise<{ profiles: Array<{ id: string; isActive: boolean }> }>;
            };
            getActive: {
                ensureData: (
                    input: undefined,
                    options: typeof BOOT_CRITICAL_QUERY_OPTIONS
                ) => Promise<{ activeProfileId: string | undefined }>;
            };
        };
    };
}

export async function prefetchSettingsRouteData(input: SettingsRoutePrefetchInput): Promise<void> {
    const [profileListResult, activeProfileResult] = await Promise.allSettled([
        input.trpcUtils.profile.list.ensureData(undefined, BOOT_CRITICAL_QUERY_OPTIONS),
        input.trpcUtils.profile.getActive.ensureData(undefined, BOOT_CRITICAL_QUERY_OPTIONS),
    ]);

    if (profileListResult.status !== 'fulfilled' || activeProfileResult.status !== 'fulfilled') {
        return;
    }

    if (!isWarmProfileListPayload(profileListResult.value) || !isWarmActiveProfilePayload(activeProfileResult.value)) {
        return;
    }

    const resolvedProfileId = resolveWarmProfileId({
        profileListPayload: profileListResult.value,
        activeProfilePayload: activeProfileResult.value,
    });
    if (!resolvedProfileId) {
        return;
    }

    prefetchSettingsData({
        profileId: resolvedProfileId,
        trpcUtils: input.trpcUtils,
    });
}
