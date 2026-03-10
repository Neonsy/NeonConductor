import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';
import { resolveActiveWorkspaceProfileId } from '@/web/components/runtime/workspaceSurfaceModel';

interface WorkspaceBootLoaderInput {
    trpcUtils: {
        profile: {
            list: {
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
        mode: {
            list: {
                prefetch: (input: { profileId: string; topLevelTab: 'chat' }) => Promise<void>;
            };
            getActive: {
                prefetch: (input: { profileId: string; topLevelTab: 'chat' }) => Promise<void>;
            };
        };
        runtime: {
            getShellBootstrap: {
                prefetch: (input: { profileId: string }) => Promise<void>;
            };
        };
    };
}

export async function prefetchWorkspaceBootData(input: WorkspaceBootLoaderInput): Promise<void> {
    const [profileList, activeProfile] = await Promise.all([
        input.trpcUtils.profile.list.ensureData(undefined, BOOT_CRITICAL_QUERY_OPTIONS),
        input.trpcUtils.profile.getActive.ensureData(undefined, BOOT_CRITICAL_QUERY_OPTIONS),
    ]);

    const resolvedProfileId = resolveActiveWorkspaceProfileId({
        activeProfileId: undefined,
        serverActiveProfileId: activeProfile.activeProfileId,
        profiles: profileList.profiles,
    });
    if (!resolvedProfileId) {
        return;
    }

    await Promise.all([
        input.trpcUtils.mode.list.prefetch({
            profileId: resolvedProfileId,
            topLevelTab: 'chat',
        }),
        input.trpcUtils.mode.getActive.prefetch({
            profileId: resolvedProfileId,
            topLevelTab: 'chat',
        }),
        input.trpcUtils.runtime.getShellBootstrap.prefetch({
            profileId: resolvedProfileId,
        }),
    ]);
}
