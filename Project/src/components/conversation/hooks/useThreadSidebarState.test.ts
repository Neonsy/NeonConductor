import { describe, expect, it } from 'vitest';

import {
    filterThreadsBySelectedTagIds,
    resolveVisibleThreadSelection,
} from '@/web/components/conversation/hooks/useThreadSidebarState';

import type { ThreadListRecord } from '@/app/backend/persistence/types';

const threads: ThreadListRecord[] = [
    {
        id: 'thr_alpha',
        profileId: 'profile_default',
        conversationId: 'conv_a',
        title: 'Alpha',
        topLevelTab: 'chat',
        rootThreadId: 'thr_alpha',
        isFavorite: false,
        executionEnvironmentMode: 'local',
        scope: 'workspace',
        workspaceFingerprint: 'ws_a',
        anchorKind: 'workspace',
        anchorId: 'ws_a',
        sessionCount: 1,
        createdAt: '2026-03-09T10:00:00.000Z',
        updatedAt: '2026-03-09T10:00:00.000Z',
    },
    {
        id: 'thr_beta',
        profileId: 'profile_default',
        conversationId: 'conv_a',
        title: 'Beta',
        topLevelTab: 'chat',
        rootThreadId: 'thr_beta',
        isFavorite: false,
        executionEnvironmentMode: 'local',
        scope: 'workspace',
        workspaceFingerprint: 'ws_a',
        anchorKind: 'workspace',
        anchorId: 'ws_a',
        sessionCount: 1,
        createdAt: '2026-03-09T10:05:00.000Z',
        updatedAt: '2026-03-09T10:05:00.000Z',
    },
];

describe('filterThreadsBySelectedTagIds', () => {
    const threadTagIdsByThread = new Map<string, string[]>([
        ['thr_alpha', ['tag_ui', 'tag_urgent']],
        ['thr_beta', ['tag_ui']],
    ]);

    it('returns all threads when no tags are selected', () => {
        expect(
            filterThreadsBySelectedTagIds({
                threads,
                threadTagIdsByThread,
                selectedTagIds: [],
            }).map((thread) => thread.id)
        ).toEqual(['thr_alpha', 'thr_beta']);
    });

    it('applies AND semantics when several tags are selected', () => {
        expect(
            filterThreadsBySelectedTagIds({
                threads,
                threadTagIdsByThread,
                selectedTagIds: ['tag_ui', 'tag_urgent'],
            }).map((thread) => thread.id)
        ).toEqual(['thr_alpha']);
    });
});

describe('resolveVisibleThreadSelection', () => {
    it('selects the first visible thread when the persisted thread selection is stale', () => {
        expect(
            resolveVisibleThreadSelection({
                visibleThreads: threads,
                selectedThreadId: 'thr_missing',
            })
        ).toEqual({
            resolvedThreadId: 'thr_alpha',
            shouldSelectFallbackThread: true,
            shouldClearSelection: false,
        });
    });

    it('clears the selection when no visible threads remain after shell filtering', () => {
        expect(
            resolveVisibleThreadSelection({
                visibleThreads: [],
                selectedThreadId: 'thr_alpha',
            })
        ).toEqual({
            resolvedThreadId: undefined,
            shouldSelectFallbackThread: false,
            shouldClearSelection: true,
        });
    });

    it('keeps a valid visible selection without forcing a shell fallback', () => {
        expect(
            resolveVisibleThreadSelection({
                visibleThreads: threads,
                selectedThreadId: 'thr_beta',
            })
        ).toEqual({
            resolvedThreadId: 'thr_beta',
            shouldSelectFallbackThread: false,
            shouldClearSelection: false,
        });
    });
});
