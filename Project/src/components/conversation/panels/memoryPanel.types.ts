import type {
    MemoryProjectionStatusResult,
    MemoryScanProjectionEditsResult,
    EntityId,
    RetrievedMemorySummary,
    TopLevelTab,
} from '@/shared/contracts';

export type MemoryPanelFeedbackTone = 'info' | 'error' | 'success';

export interface MemoryPanelProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
    sandboxId?: EntityId<'sb'>;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
    retrievedMemory?: RetrievedMemorySummary;
}

export interface MemoryPanelViewModel {
    contextLabel: string;
    canonicalMemoryNote: string;
    includeBroaderScopes: boolean;
    projectionRoots: MemoryProjectionStatusResult['paths'];
    projectionStatus: MemoryProjectionStatusResult | undefined;
    isProjectionRefreshing: boolean;
    isReviewRefreshing: boolean;
    retrievedMemoryIdSet: Set<string>;
    retrievedSection: {
        records: RetrievedMemorySummary['records'];
        count: number;
        emptyMessage: string;
    };
    projectedSection: {
        records: MemoryProjectionStatusResult['projectedMemories'];
        count: number;
        emptyMessage: string;
    };
    reviewSection: {
        proposals: MemoryScanProjectionEditsResult['proposals'];
        parseErrors: MemoryScanProjectionEditsResult['parseErrors'];
        proposalCount: number;
        parseErrorCount: number;
    };
}

export interface MemoryPanelController {
    viewModel: MemoryPanelViewModel;
    feedbackMessage: string | undefined;
    feedbackTone: MemoryPanelFeedbackTone;
    clearFeedback: () => void;
    setIncludeBroaderScopes: (value: boolean) => void;
    isSyncingProjection: boolean;
    isRescanningProjectionEdits: boolean;
    isApplyingProjectionEdit: boolean;
    onRescanProjectionEdits: () => Promise<void>;
    onSyncProjection: () => void;
    onApplyProjectionEdit: (input: {
        memoryId: EntityId<'mem'>;
        observedContentHash: string;
        decision: 'accept' | 'reject';
    }) => void;
}

export interface MemoryPanelViewModelInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    includeBroaderScopes: boolean;
    projectionStatus: MemoryProjectionStatusResult | undefined;
    projectionStatusIsFetching: boolean;
    scanProjectionEdits: MemoryScanProjectionEditsResult | undefined;
    scanProjectionEditsIsFetching: boolean;
    retrievedMemory?: RetrievedMemorySummary;
}
