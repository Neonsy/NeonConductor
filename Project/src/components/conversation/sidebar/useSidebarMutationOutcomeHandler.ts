import type { SidebarMutationOutcome, SidebarSelectionState } from '@/web/components/conversation/sidebar/sidebarTypes';

export function resolveSidebarSelectionAfterMutation(
    input: SidebarSelectionState & {
        outcome: SidebarMutationOutcome;
    }
) {
    if (input.outcome.kind !== 'deleted_workspace_threads') {
        return {
            selectedThreadId: input.selectedThreadId,
            selectedSessionId: input.selectedSessionId,
            selectedRunId: input.selectedRunId,
        };
    }

    if (input.selectedThreadId && input.outcome.deletedThreadIds.includes(input.selectedThreadId)) {
        return {
            selectedThreadId: undefined,
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }

    if (input.selectedSessionId && input.outcome.deletedSessionIds.includes(input.selectedSessionId)) {
        return {
            selectedThreadId: input.selectedThreadId,
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }

    if (
        input.selectedThread?.workspaceFingerprint === input.outcome.workspaceFingerprint &&
        input.outcome.deletedThreadIds.length > 0
    ) {
        return {
            selectedThreadId: input.selectedThreadId,
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }

    return {
        selectedThreadId: input.selectedThreadId,
        selectedSessionId: input.selectedSessionId,
        selectedRunId: input.selectedRunId,
    };
}
