import { describe, expect, it, vi } from 'vitest';

import { buildConversationUiSyncPatch } from '@/web/components/conversation/shell/queries/useConversationSync';

type ConversationUiState = import('@/web/components/conversation/hooks/useConversationUiState').ConversationUiState;
type ConversationRecord = import('@/app/backend/persistence/types').ConversationRecord;
type TagRecord = import('@/app/backend/persistence/types').TagRecord;
type ThreadListRecord = import('@/app/backend/persistence/types').ThreadListRecord;

function createUiState(overrides: Partial<ConversationUiState> = {}): ConversationUiState {
    return {
        scopeFilter: 'all',
        workspaceFilter: 'ws_missing',
        sort: null,
        showAllModes: false,
        groupView: 'workspace',
        selectedThreadId: undefined,
        selectedSessionId: undefined,
        selectedRunId: undefined,
        selectedTagIds: ['tag_kept', 'tag_missing'],
        setScopeFilter: vi.fn(),
        setWorkspaceFilter: vi.fn(),
        setSort: vi.fn(),
        setShowAllModes: vi.fn(),
        setGroupView: vi.fn(),
        setSelectedThreadId: vi.fn(),
        setSelectedSessionId: vi.fn(),
        setSelectedRunId: vi.fn(),
        setSelectedTagIds: vi.fn(),
        ...overrides,
    };
}

function createThread(overrides: Partial<ThreadListRecord> = {}): ThreadListRecord {
    return {
        id: 'thr_default',
        profileId: 'profile_default',
        conversationId: 'conv_default',
        title: 'Thread',
        topLevelTab: 'chat',
        rootThreadId: 'thr_default',
        isFavorite: false,
        executionEnvironmentMode: 'local',
        scope: 'workspace',
        workspaceFingerprint: 'ws_1',
        anchorKind: 'workspace',
        anchorId: 'ws_1',
        sessionCount: 1,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        ...overrides,
    };
}

function createTag(overrides: Partial<TagRecord> = {}): TagRecord {
    return {
        id: 'tag_kept',
        profileId: 'profile_default',
        label: 'Kept',
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        ...overrides,
    };
}

function createBucket(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
    return {
        id: 'conv_default',
        profileId: 'profile_default',
        scope: 'workspace',
        workspaceFingerprint: 'ws_1',
        title: 'Workspace',
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        ...overrides,
    };
}

describe('conversation UI sync patch', () => {
    it('computes only the patch needed to reconcile persisted and available state', () => {
        const patch = buildConversationUiSyncPatch({
            uiState: createUiState(),
            threads: {
                sort: 'latest',
                showAllModes: true,
                groupView: 'branch',
                threads: [createThread()],
            },
            tags: [createTag()],
            buckets: [createBucket()],
        });

        expect(patch).toEqual({
            sort: 'latest',
            showAllModes: true,
            groupView: 'branch',
            selectedTagIds: ['tag_kept'],
            workspaceFilter: undefined,
        });
    });

    it('returns undefined when the current UI state is already valid', () => {
        const patch = buildConversationUiSyncPatch({
            uiState: createUiState({
                sort: 'latest',
                showAllModes: true,
                groupView: 'branch',
                selectedTagIds: ['tag_kept'],
                workspaceFilter: 'ws_1',
            }),
            threads: {
                sort: 'latest',
                showAllModes: true,
                groupView: 'branch',
                threads: [createThread()],
            },
            tags: [createTag()],
            buckets: [createBucket()],
        });

        expect(patch).toBeUndefined();
    });
});
