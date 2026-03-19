import type { SelectionResolutionState } from '@/web/components/conversation/hooks/useSessionRunSelection';

export interface ConversationSelectionSyncPatch {
    selectedSessionId?: string | undefined;
    selectedRunId?: string | undefined;
}

export function buildConversationSelectionSyncPatch(input: {
    selection: SelectionResolutionState;
}): ConversationSelectionSyncPatch | undefined {
    const patch: ConversationSelectionSyncPatch = {};

    if (input.selection.shouldUpdateSessionSelection) {
        patch.selectedSessionId = input.selection.resolvedSessionId;
    }

    if (input.selection.shouldUpdateRunSelection) {
        patch.selectedRunId = input.selection.resolvedRunId;
    }

    return Object.keys(patch).length > 0 ? patch : undefined;
}
