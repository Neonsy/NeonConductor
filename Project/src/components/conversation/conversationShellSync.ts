import { useEffect } from 'react';

import type { ConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

interface ConversationShellSyncInput {
    profileId: string;
    uiState: ConversationUiState;
    threads: {
        sort?: 'latest' | 'alphabetical';
        showAllModes?: boolean;
        groupView?: 'workspace' | 'branch';
        threads: ThreadListRecord[];
    } | undefined;
    tags: TagRecord[] | undefined;
    buckets: ConversationRecord[] | undefined;
    onProfileReset: () => void;
}

export function useConversationShellSync(input: ConversationShellSyncInput): void {
    useEffect(() => {
        input.onProfileReset();
    }, [input.onProfileReset, input.profileId]);

    useEffect(() => {
        if (input.uiState.sort || !input.threads?.sort) {
            return;
        }

        input.uiState.setSort(input.threads.sort);
    }, [input.threads?.sort, input.uiState]);

    useEffect(() => {
        if (input.threads?.showAllModes === undefined) {
            return;
        }
        if (input.uiState.showAllModes === input.threads.showAllModes) {
            return;
        }
        input.uiState.setShowAllModes(input.threads.showAllModes);
    }, [input.threads?.showAllModes, input.uiState]);

    useEffect(() => {
        const nextGroupView = input.threads?.groupView;
        if (!nextGroupView) {
            return;
        }
        if (input.uiState.groupView === nextGroupView) {
            return;
        }
        input.uiState.setGroupView(nextGroupView);
    }, [input.threads?.groupView, input.uiState]);

    useEffect(() => {
        const selectedTagId = input.uiState.selectedTagId;
        if (!selectedTagId) {
            return;
        }

        const tagExists = (input.tags ?? []).some((tag) => tag.id === selectedTagId);
        if (!tagExists) {
            input.uiState.setSelectedTagId(undefined);
        }
    }, [input.tags, input.uiState]);

    useEffect(() => {
        const workspaceFilter = input.uiState.workspaceFilter;
        if (!workspaceFilter) {
            return;
        }

        const workspaceExists = (input.buckets ?? [])
            .filter((bucket) => bucket.scope === 'workspace')
            .some((bucket) => bucket.workspaceFingerprint === workspaceFilter);
        if (!workspaceExists) {
            input.uiState.setWorkspaceFilter(undefined);
        }
    }, [input.buckets, input.uiState]);
}
