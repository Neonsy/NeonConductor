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
        runtime: {
            getShellBootstrap: {
                useQuery: () => ({
                    data: {
                        providers: [
                            {
                                id: 'kilo',
                                label: 'Kilo',
                                authState: 'authenticated',
                                authMethod: 'oauth',
                                isDefault: true,
                            },
                        ],
                        providerModels: [
                            {
                                id: 'kilo-auto/frontier',
                                providerId: 'kilo',
                                label: 'Kilo Auto Frontier',
                                supportsTools: true,
                                supportsVision: false,
                                supportsReasoning: true,
                                toolProtocol: 'kilo_gateway',
                            },
                        ],
                        workspacePreferences: [],
                        defaults: {
                            providerId: 'kilo',
                            modelId: 'kilo-auto/frontier',
                        },
                    },
                }),
            },
            registerWorkspaceRoot: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            setWorkspacePreference: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
        },
        useUtils: () => ({
            runtime: {
                listWorkspaceRoots: { setData: vi.fn() },
                getShellBootstrap: { setData: vi.fn() },
            },
        }),
    },
}));

describe('conversation sidebar layout', () => {
    it('keeps workspaces and threads together in one sidebar tree', () => {
        const html = renderToStaticMarkup(
            <ConversationSidebar
                profileId='profile_default'
                isCollapsed={false}
                onToggleCollapsed={vi.fn()}
                buckets={buckets}
                threads={threads}
                sessions={sessions}
                tags={tags}
                threadTagIdsByThread={new Map([['thr_root', ['tag_ui']]])}
                workspaceRoots={[
                    {
                        fingerprint: 'ws_alpha',
                        label: 'Workspace Alpha',
                        absolutePath: 'C:\\Alpha',
                    },
                ]}
                preferredWorkspaceFingerprint='ws_alpha'
                selectedTagIds={[]}
                scopeFilter='all'
                sort='latest'
                showAllModes={false}
                groupView='workspace'
                isAddingTag={false}
                isDeletingWorkspaceThreads={false}
                isCreatingThread={false}
                onSelectThread={vi.fn()}
                onToggleTagFilter={vi.fn()}
                onToggleThreadFavorite={vi.fn(async () => {})}
                onScopeFilterChange={vi.fn()}
                onWorkspaceFilterChange={vi.fn()}
                onSortChange={vi.fn()}
                onShowAllModesChange={vi.fn()}
                onGroupViewChange={vi.fn()}
                onSelectWorkspaceFingerprint={vi.fn()}
                onAddTagToThread={vi.fn(async () => {})}
                onDeleteWorkspaceThreads={vi.fn(async () => {})}
                onCreateThread={vi.fn(async () => {})}
            />
        );

        expect(html).toContain('Sessions');
        expect(html).toContain('Add workspace');
        expect(html).toContain('Workspace Alpha');
        expect(html).toContain('Root Thread');
        expect(html).toContain('New thread');
        expect(html).not.toContain('Workspace parent');
    });
});
