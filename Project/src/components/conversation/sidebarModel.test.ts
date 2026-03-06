import { describe, expect, it } from 'vitest';

import { buildConversationSidebarModel } from '@/web/components/conversation/sidebarModel';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

const buckets: ConversationRecord[] = [
    {
        id: 'conv_1',
        profileId: 'profile_default',
        scope: 'workspace',
        workspaceFingerprint: 'ws_b',
        title: 'Workspace B',
        createdAt: '2026-03-06T10:00:00.000Z',
        updatedAt: '2026-03-06T10:00:00.000Z',
    },
    {
        id: 'conv_2',
        profileId: 'profile_default',
        scope: 'workspace',
        workspaceFingerprint: 'ws_a',
        title: 'Workspace A',
        createdAt: '2026-03-06T10:00:00.000Z',
        updatedAt: '2026-03-06T10:00:00.000Z',
    },
];

const threads: ThreadListRecord[] = [
    {
        id: 'thr_root',
        profileId: 'profile_default',
        conversationId: 'conv_1',
        title: 'Root Thread',
        topLevelTab: 'chat',
        rootThreadId: 'thr_root',
        scope: 'workspace',
        workspaceFingerprint: 'ws_b',
        anchorKind: 'workspace',
        anchorId: 'ws_b',
        sessionCount: 1,
        createdAt: '2026-03-06T10:00:00.000Z',
        updatedAt: '2026-03-06T10:00:00.000Z',
    },
    {
        id: 'thr_child',
        profileId: 'profile_default',
        conversationId: 'conv_1',
        title: 'Child Thread',
        topLevelTab: 'chat',
        parentThreadId: 'thr_root',
        rootThreadId: 'thr_root',
        scope: 'workspace',
        workspaceFingerprint: 'ws_b',
        anchorKind: 'workspace',
        anchorId: 'ws_b',
        sessionCount: 1,
        createdAt: '2026-03-06T10:05:00.000Z',
        updatedAt: '2026-03-06T10:05:00.000Z',
    },
];

const tags: TagRecord[] = [
    {
        id: 'tag_1',
        profileId: 'profile_default',
        label: 'Pinned',
        createdAt: '2026-03-06T10:00:00.000Z',
        updatedAt: '2026-03-06T10:00:00.000Z',
    },
];

describe('buildConversationSidebarModel', () => {
    it('builds sorted workspace options and selected thread lookup', () => {
        const model = buildConversationSidebarModel({
            buckets,
            threads,
            tags,
            selectedThreadId: 'thr_child',
            groupView: 'workspace',
        });

        expect(model.workspaceOptions).toEqual(['ws_a', 'ws_b']);
        expect(model.selectedThread?.id).toBe('thr_child');
        expect(model.tagLabelById.get('tag_1')).toBe('Pinned');
        expect(model.groupedThreadRows).toHaveLength(1);
        expect(model.groupedThreadRows[0]?.rows.map((row) => row.thread.id)).toEqual(['thr_root', 'thr_child']);
    });

    it('builds branch rows when branch view is selected', () => {
        const model = buildConversationSidebarModel({
            buckets,
            threads,
            tags,
            groupView: 'branch',
        });

        expect(model.groupedThreadRows[0]?.rows.map((row) => row.depth)).toEqual([0, 1]);
    });
});
