import { resolveWorkspaceActiveModeKey, MISSING_PROFILE_ID } from '@/web/components/runtime/workspaceSurfaceModel';
import { refetchWorkspaceModeQueries } from '@/web/components/runtime/workspaceSurfaceRefetch';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceModeState(input: {
    resolvedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
}) {
    const modeListQuery = trpc.mode.list.useQuery(
        {
            profileId: input.resolvedProfileId ?? MISSING_PROFILE_ID,
            topLevelTab: input.topLevelTab,
        },
        {
            enabled: Boolean(input.resolvedProfileId),
            refetchOnWindowFocus: false,
        }
    );
    const modeActiveQuery = trpc.mode.getActive.useQuery(
        {
            profileId: input.resolvedProfileId ?? MISSING_PROFILE_ID,
            topLevelTab: input.topLevelTab,
        },
        {
            enabled: Boolean(input.resolvedProfileId),
            refetchOnWindowFocus: false,
        }
    );
    const setActiveModeMutation = trpc.mode.setActive.useMutation({
        onSuccess: () => {
            void refetchWorkspaceModeQueries({
                modeListQuery,
                modeActiveQuery,
            });
        },
    });

    return {
        modes: modeActiveQuery.data?.modes ?? modeListQuery.data?.modes ?? [],
        activeModeKey: resolveWorkspaceActiveModeKey(input.topLevelTab, modeActiveQuery.data?.activeMode.modeKey),
        setActiveModeMutation,
        selectMode: async (modeKey: string) => {
            if (!modeKey || setActiveModeMutation.isPending || !input.resolvedProfileId) {
                return;
            }

            await setActiveModeMutation.mutateAsync({
                profileId: input.resolvedProfileId,
                topLevelTab: input.topLevelTab,
                modeKey,
            });
        },
    };
}
