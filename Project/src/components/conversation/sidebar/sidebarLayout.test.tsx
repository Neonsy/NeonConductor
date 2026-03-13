import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConversationSidebar } from '@/web/components/conversation/sidebar/sidebar';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

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

describe('conversation sidebar layout', () => {
    it('moves top-level tabs into the rail and keeps thread creation out of the default flow', () => {
        const html = renderToStaticMarkup(
            <ConversationSidebar
                profileId='profile_default'
                isCollapsed={false}
                onToggleCollapsed={vi.fn()}
                buckets={buckets}
                threads={threads}
                tags={tags}
                threadTagIdsByThread={new Map([['thr_root', ['tag_ui']]])}
                topLevelTab='chat'
                workspaceRoots={[
                    {
                        fingerprint: 'ws_alpha',
                        label: 'Workspace Alpha',
                        absolutePath: 'C:\\Alpha',
                    },
                ]}
                preferredWorkspaceFingerprint='ws_alpha'
                preferredProviderId='kilo'
                preferredModelId='kilo-auto/frontier'
                modelOptions={[
                    {
                        id: 'kilo-auto/frontier',
                        label: 'Kilo Auto Frontier',
                        providerId: 'kilo',
                        providerLabel: 'Kilo',
                        supportsTools: true,
                        supportsVision: true,
                        supportsReasoning: true,
                        capabilityBadges: [],
                        compatibilityState: 'compatible',
                    },
                ]}
                selectedTagIds={[]}
                scopeFilter='all'
                sort='latest'
                showAllModes={false}
                groupView='workspace'
                isAddingTag={false}
                isDeletingWorkspaceThreads={false}
                onSelectThread={vi.fn()}
                onToggleTagFilter={vi.fn()}
                onToggleThreadFavorite={vi.fn(async () => {})}
                onScopeFilterChange={vi.fn()}
                onWorkspaceFilterChange={vi.fn()}
                onSortChange={vi.fn()}
                onShowAllModesChange={vi.fn()}
                onGroupViewChange={vi.fn()}
                onCreateThread={vi.fn(async () => {})}
                onAddTagToThread={vi.fn(async () => {})}
                onDeleteWorkspaceThreads={vi.fn(async () => {})}
                onNavigateToWorkspaces={vi.fn()}
            />
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
