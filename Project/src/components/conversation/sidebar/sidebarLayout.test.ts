import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConversationSidebar } from '@/web/components/conversation/sidebar/sidebar';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';
import type { SessionSummaryRecord } from '@/app/backend/persistence/types';

const buckets: ConversationRecord[] = [
    {
        id: 'conv_workspace',
        profileId: 'profile_default',
        scope: 'workspace',
        workspaceFingerprint: 'ws_alpha',
        title: 'Workspace Alpha',
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:00:00.000Z',
    },
];

const threads: ThreadListRecord[] = [
    {
        id: 'thr_root',
        profileId: 'profile_default',
        conversationId: 'conv_workspace',
        title: 'Root Thread',
        topLevelTab: 'chat',
        rootThreadId: 'thr_root',
        isFavorite: false,
        executionEnvironmentMode: 'local',
        scope: 'workspace',
        workspaceFingerprint: 'ws_alpha',
        anchorKind: 'workspace',
        anchorId: 'ws_alpha',
        sessionCount: 1,
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:00:00.000Z',
    },
];

const tags: TagRecord[] = [
    {
        id: 'tag_ui',
        profileId: 'profile_default',
        label: 'UI',
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:00:00.000Z',
    },
];

const sessions: SessionSummaryRecord[] = [
    {
        id: 'sess_root',
        profileId: 'profile_default',
        conversationId: 'conv_workspace',
        threadId: 'thr_root',
        kind: 'local',
        runStatus: 'completed',
        turnCount: 1,
        updatedAt: '2026-03-12T09:00:00.000Z',
        createdAt: '2026-03-12T09:00:00.000Z',
    },
];

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        conversation: {
            getWorkspaceThreadDeletePreview: {
                useQuery: () => ({
                    data: undefined,
                    isLoading: false,
                }),
            },
        },
    },
}));

describe('conversation sidebar layout', () => {
    it('keeps thread composition in the rail while preserving search and filter controls', () => {
        const html = renderToStaticMarkup(
            createElement(ConversationSidebar, {
                profileId: 'profile_default',
                isCollapsed: false,
                onToggleCollapsed: vi.fn(),
                buckets,
                threads,
                sessions,
                tags,
                threadTagIdsByThread: new Map([['thr_root', ['tag_ui']]]),
                workspaceRoots: [
                    {
                        fingerprint: 'ws_alpha',
                        label: 'Workspace Alpha',
                        absolutePath: 'C:\\Alpha',
                    },
                ],
                preferredWorkspaceFingerprint: 'ws_alpha',
                selectedTagIds: [],
                scopeFilter: 'all',
                sort: 'latest',
                showAllModes: false,
                groupView: 'workspace',
                isAddingTag: false,
                isDeletingWorkspaceThreads: false,
                onSelectThread: vi.fn(),
                onToggleTagFilter: vi.fn(),
                onToggleThreadFavorite: vi.fn(async () => {}),
                onScopeFilterChange: vi.fn(),
                onWorkspaceFilterChange: vi.fn(),
                onSortChange: vi.fn(),
                onShowAllModesChange: vi.fn(),
                onGroupViewChange: vi.fn(),
                onRequestNewThread: vi.fn(),
                onSelectWorkspaceFingerprint: vi.fn(),
                onAddTagToThread: vi.fn(async () => {}),
                onDeleteWorkspaceThreads: vi.fn(async () => {}),
                onNavigateToWorkspaces: vi.fn(),
            })
        );

        expect(html).toContain('Sessions');
        expect(html).toContain('Search threads, workspaces, or tabs');
        expect(html).toContain('Filters');
        expect(html).toContain('Add workspace');
        expect(html).toContain('New thread');
        expect(html).toContain('Workspace parent');
        expect(html).not.toContain('Optional thread title');
    });
});
