import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';
import { resolveWorkspaceActiveModeKey, MISSING_PROFILE_ID } from '@/web/components/runtime/workspaceSurfaceModel';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/shared/contracts';

export function useWorkspaceModeState(input: {
    resolvedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
    workspaceFingerprint?: string;
}) {
    const utils = trpc.useUtils();
    const modeQueryInput = {
        profileId: input.resolvedProfileId ?? MISSING_PROFILE_ID,
        topLevelTab: input.topLevelTab,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    };
    const modeListQuery = trpc.mode.list.useQuery(
        modeQueryInput,
        {
            enabled: Boolean(input.resolvedProfileId),
            ...BOOT_CRITICAL_QUERY_OPTIONS,
        }
    );
    const modeActiveQuery = trpc.mode.getActive.useQuery(
        modeQueryInput,
        {
            enabled: Boolean(input.resolvedProfileId),
            ...BOOT_CRITICAL_QUERY_OPTIONS,
        }
    );
    const setActiveModeMutation = trpc.mode.setActive.useMutation({
        onSuccess: (result) => {
            if (!result.updated || !input.resolvedProfileId) {
                return;
            }

            utils.mode.getActive.setData(modeQueryInput, (current) => ({
                activeMode: result.mode,
                modes: current?.modes ?? modeListQuery.data?.modes ?? [result.mode],
            }));
            utils.mode.list.setData(modeQueryInput, (current) => ({
                modes: current?.modes ?? modeActiveQuery.data?.modes ?? [result.mode],
            }));
        },
    });

    return {
        modes: modeActiveQuery.data?.modes ?? modeListQuery.data?.modes ?? [],
        activeModeKey: resolveWorkspaceActiveModeKey(input.topLevelTab, modeActiveQuery.data?.activeMode.modeKey),
        hasResolvedInitialMode:
            Boolean(input.resolvedProfileId) && (!modeActiveQuery.isPending || !modeListQuery.isPending),
        modePending: Boolean(input.resolvedProfileId) && (modeActiveQuery.isPending || modeListQuery.isPending),
        modeErrorMessage: modeActiveQuery.error?.message ?? modeListQuery.error?.message,
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

