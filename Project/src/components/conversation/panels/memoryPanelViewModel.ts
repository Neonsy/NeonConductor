import type { MemoryPanelViewModelInput, MemoryPanelViewModel } from '@/web/components/conversation/panels/memoryPanel.types';

export function buildMemoryPanelViewModel(input: MemoryPanelViewModelInput): MemoryPanelViewModel {
    const retrievedRecords = input.retrievedMemory?.records ?? [];
    const projectedMemories = input.projectionStatus?.projectedMemories ?? [];
    const proposals = input.scanProjectionEdits?.proposals ?? [];
    const parseErrors = input.scanProjectionEdits?.parseErrors ?? [];

    return {
        contextLabel: `${input.topLevelTab}.${input.modeKey}`,
        canonicalMemoryNote: 'Canonical memory is the backend source of truth. Projected files are review-only until applied.',
        includeBroaderScopes: input.includeBroaderScopes,
        projectionRoots: input.projectionStatus?.paths ?? {
            globalMemoryRoot: 'Loading…',
        },
        projectionStatus: input.projectionStatus,
        isProjectionRefreshing: input.projectionStatusIsFetching,
        isReviewRefreshing: input.scanProjectionEditsIsFetching,
        retrievedMemoryIdSet: new Set(retrievedRecords.map((record) => record.memoryId)),
        retrievedSection: {
            records: retrievedRecords,
            count: retrievedRecords.length,
            emptyMessage: 'No memory was injected into the current resolved context.',
        },
        projectedSection: {
            records: projectedMemories,
            count: projectedMemories.length,
            emptyMessage: `No memory is in scope for the current ${input.topLevelTab}.${input.modeKey} context.`,
        },
        reviewSection: {
            proposals,
            parseErrors,
            proposalCount: proposals.length,
            parseErrorCount: parseErrors.length,
        },
    };
}
