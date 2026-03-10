import { resolveWorkspaceActiveModeKey, MISSING_PROFILE_ID } from '@/web/components/runtime/workspaceSurfaceModel';
import { refetchWorkspaceModeQueries } from '@/web/components/runtime/workspaceSurfaceRefetch';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceModeState(input: {
    resolvedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
    workspaceFingerprint?: string;
}) {
    const modeListQuery = trpc.mode.list.useQuery(
        {
            profileId: input.resolvedProfileId ?? MISSING_PROFILE_ID,
            topLevelTab: input.topLevelTab,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
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
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
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
        hasResolvedInitialMode:
            Boolean(input.resolvedProfileId) && (modeActiveQuery.isSuccess || modeListQuery.isSuccess),
        setActiveModeMutation,
        selectMode: async (modeKey: string) => {
            if (!modeKey || setActiveModeMutation.isPending || !input.resolvedProfileId) {
                return;
            }

            await setActiveModeMutation.mutateAsync({
                profileId: input.resolvedProfileId,
                topLevelTab: input.topLevelTab,
                modeKey,
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            });
        },
    };
}
