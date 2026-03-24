import { useState } from 'react';

import type { SidebarMutationResult } from '@/web/components/conversation/sidebar/sidebarMutationResult';
import { SECONDARY_QUERY_OPTIONS } from '@/web/lib/query/secondaryQueryOptions';
import { trpc } from '@/web/trpc/client';

interface UseSidebarWorkspaceDeleteControllerInput {
    profileId: string;
    isDeletingWorkspaceThreads: boolean;
    onDeleteWorkspaceThreads: (input: {
        workspaceFingerprint: string;
        includeFavoriteThreads: boolean;
    }) => Promise<SidebarMutationResult>;
    onFeedbackMessageChange: (message: string | undefined) => void;
}

export function useSidebarWorkspaceDeleteController(input: UseSidebarWorkspaceDeleteControllerInput) {
    const [workspaceDeleteTarget, setWorkspaceDeleteTarget] = useState<
        | {
              workspaceFingerprint: string;
              workspaceLabel: string;
          }
        | undefined
    >(undefined);
    const [includeFavoriteThreads, setIncludeFavoriteThreads] = useState(false);
    const workspaceDeletePreviewQuery = trpc.conversation.getWorkspaceThreadDeletePreview.useQuery(
        {
            profileId: input.profileId,
            workspaceFingerprint: workspaceDeleteTarget?.workspaceFingerprint ?? '',
            includeFavorites: includeFavoriteThreads,
        },
        {
            enabled: Boolean(workspaceDeleteTarget),
            ...SECONDARY_QUERY_OPTIONS,
        }
    );

    return {
        target: workspaceDeleteTarget,
        includeFavoriteThreads,
        previewQuery: workspaceDeletePreviewQuery,
        busy: input.isDeletingWorkspaceThreads || workspaceDeletePreviewQuery.isLoading,
        requestWorkspaceDelete(workspaceFingerprint: string, workspaceLabel: string) {
            input.onFeedbackMessageChange(undefined);
            setIncludeFavoriteThreads(false);
            setWorkspaceDeleteTarget({
                workspaceFingerprint,
                workspaceLabel,
            });
        },
        setIncludeFavoriteThreads,
        cancelWorkspaceDelete() {
            setWorkspaceDeleteTarget(undefined);
            setIncludeFavoriteThreads(false);
        },
        async confirmWorkspaceDelete() {
            if (!workspaceDeleteTarget) {
                return;
            }

            input.onFeedbackMessageChange(undefined);
            const result = await input.onDeleteWorkspaceThreads({
                workspaceFingerprint: workspaceDeleteTarget.workspaceFingerprint,
                includeFavoriteThreads,
            });
            if (!result.ok) {
                input.onFeedbackMessageChange(result.message);
                return;
            }

            setWorkspaceDeleteTarget(undefined);
            setIncludeFavoriteThreads(false);
        },
    };
}
