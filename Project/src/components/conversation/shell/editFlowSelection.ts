import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';

import type { TopLevelTab } from '@/shared/contracts';

export interface EditFlowSelectionTransition {
    selectedThreadId?: string;
    selectedSessionId: string;
    selectedRunId: string | undefined;
    nextTopLevelTab?: TopLevelTab;
}

export function buildBranchSelectionTransition(input: {
    currentTopLevelTab: TopLevelTab;
    result: {
        sessionId: string;
        threadId: string;
        topLevelTab: TopLevelTab;
    };
}): EditFlowSelectionTransition {
    return {
        ...(isEntityId(input.result.threadId, 'thr') ? { selectedThreadId: input.result.threadId } : {}),
        selectedSessionId: input.result.sessionId,
        selectedRunId: undefined,
        ...(input.result.topLevelTab !== input.currentTopLevelTab ? { nextTopLevelTab: input.result.topLevelTab } : {}),
    };
}

export function buildEditSelectionTransition(input: {
    currentTopLevelTab: TopLevelTab;
    result: {
        sessionId: string;
        threadId?: string;
        runId?: string;
        topLevelTab?: TopLevelTab;
    };
}): EditFlowSelectionTransition {
    return {
        ...(isEntityId(input.result.threadId, 'thr') ? { selectedThreadId: input.result.threadId } : {}),
        selectedSessionId: input.result.sessionId,
        selectedRunId: input.result.runId,
        ...(input.result.topLevelTab && input.result.topLevelTab !== input.currentTopLevelTab
            ? { nextTopLevelTab: input.result.topLevelTab }
            : {}),
    };
}
