import { FolderPlus, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';

import { SidebarRailHeader } from '@/web/components/conversation/sidebar/sections/sidebarRailHeader';
import { SidebarThreadBrowser } from '@/web/components/conversation/sidebar/sections/sidebarThreadBrowser';
import { WorkspaceDeleteDialog } from '@/web/components/conversation/sidebar/sections/workspaceDeleteDialog';
import { Button } from '@/web/components/ui/button';
import { SECONDARY_QUERY_OPTIONS } from '@/web/lib/query/secondaryQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';
import type { SessionSummaryRecord } from '@/app/backend/persistence/types';

interface ConversationSidebarProps {
    profileId: string;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    sessions: SessionSummaryRecord[];
    tags: TagRecord[];
    threadTagIdsByThread: Map<string, string[]>;
    workspaceRoots: Array<{
        fingerprint: string;
        label: string;
        absolutePath: string;
    }>;
    preferredWorkspaceFingerprint?: string;
    selectedThreadId?: string;
    selectedTagIds: string[];
    scopeFilter: 'all' | 'workspace' | 'detached';
    workspaceFilter?: string;
    sort: 'latest' | 'alphabetical';
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    isAddingTag: boolean;
    isDeletingWorkspaceThreads: boolean;
    statusMessage?: string;
    statusTone?: 'info' | 'error';
    onSelectThread: (threadId: string) => void;
    onPreviewThread?: (threadId: string) => void;
    onToggleTagFilter: (tagId: string) => void;
    onToggleThreadFavorite: (threadId: string, nextFavorite: boolean) => Promise<void>;
    onScopeFilterChange: (scope: 'all' | 'workspace' | 'detached') => void;
    onWorkspaceFilterChange: (workspaceFingerprint?: string) => void;
    onSortChange: (sort: 'latest' | 'alphabetical') => void;
    onShowAllModesChange: (showAllModes: boolean) => void;
    onGroupViewChange: (groupView: 'workspace' | 'branch') => void;
    onRequestNewThread: (workspaceFingerprint?: string) => void;
    onSelectWorkspaceFingerprint: (workspaceFingerprint: string | undefined) => void;
    onAddTagToThread: (threadId: string, label: string) => Promise<void>;
    onDeleteWorkspaceThreads: (input: {
        workspaceFingerprint: string;
        includeFavoriteThreads: boolean;
    }) => Promise<void>;
    onNavigateToWorkspaces: () => void;
}

export function ConversationSidebar({
    profileId,
    isCollapsed,
    onToggleCollapsed,
    buckets,
    threads,
    sessions,
    tags,
    threadTagIdsByThread,
    workspaceRoots,
    preferredWorkspaceFingerprint,
    selectedThreadId,
    selectedTagIds,
    scopeFilter,
    workspaceFilter,
    sort,
    showAllModes,
    groupView,
    isAddingTag,
    isDeletingWorkspaceThreads,
    statusMessage,
    statusTone = 'info',
    onSelectThread,
    onPreviewThread,
    onToggleTagFilter,
    onToggleThreadFavorite,
    onScopeFilterChange,
    onWorkspaceFilterChange,
    onSortChange,
    onShowAllModesChange,
    onGroupViewChange,
    onRequestNewThread,
    onSelectWorkspaceFingerprint,
    onAddTagToThread,
    onDeleteWorkspaceThreads,
    onNavigateToWorkspaces,
}: ConversationSidebarProps) {
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [workspaceDeleteTarget, setWorkspaceDeleteTarget] = useState<
        | {
              workspaceFingerprint: string;
              workspaceLabel: string;
          }
        | undefined
    >(undefined);
    const [includeFavoriteThreads, setIncludeFavoriteThreads] = useState(false);
    const workspaceDeletePreviewQuery = trpc.conversation.getWorkspaceThreadDeletePreview.useQuery(
        {
            profileId,
            workspaceFingerprint: workspaceDeleteTarget?.workspaceFingerprint ?? '',
            includeFavorites: includeFavoriteThreads,
        },
        {
            enabled: Boolean(workspaceDeleteTarget),
            ...SECONDARY_QUERY_OPTIONS,
        }
    );

    return (
        <>
            <aside
                className={`border-border/70 bg-card/40 flex min-h-0 shrink-0 flex-col border-r transition-[width] duration-200 ${
                    isCollapsed ? 'w-[76px]' : 'w-[272px] xl:w-[288px]'
                }`}>
                <SidebarRailHeader
                    compact={isCollapsed}
                    {...(feedbackMessage ? { feedbackMessage } : {})}
                    {...(statusMessage ? { statusMessage, statusTone } : {})}
                    onToggleCollapsed={onToggleCollapsed}
                    primaryAction={
                        isCollapsed ? (
                            <Button
                                type='button'
                                size='icon'
                                variant='outline'
                                className='h-10 w-10 rounded-2xl'
                                aria-label='Add workspace'
                                title='Add workspace'
                                onClick={() => {
                                    onNavigateToWorkspaces();
                                }}>
                                <FolderPlus className='h-4 w-4' />
                            </Button>
                        ) : (
                            <Button
                                type='button'
                                size='sm'
                                variant='secondary'
                                className='h-9 w-full rounded-xl whitespace-nowrap'
                                onClick={() => {
                                    onNavigateToWorkspaces();
                                }}>
                                Add workspace
                            </Button>
                        )
                    }
                />

                {isCollapsed ? (
                    <div className='flex flex-1 flex-col items-center gap-3 px-3 py-4'>
                        <Button
                            type='button'
                            size='icon'
                            variant='outline'
                            className='h-10 w-10 rounded-2xl'
                            aria-label='Expand threads sidebar'
                            title='Expand threads sidebar'
                            onClick={onToggleCollapsed}>
                            <PanelLeftOpen className='h-4 w-4' />
                        </Button>
                    </div>
                ) : (
                    <>
                        <SidebarThreadBrowser
                            buckets={buckets}
                            threads={threads}
                            sessions={sessions}
                            tags={tags}
                            workspaceRoots={workspaceRoots}
                            threadTagIdsByThread={threadTagIdsByThread}
                            {...(selectedThreadId ? { selectedThreadId } : {})}
                            {...(preferredWorkspaceFingerprint
                                ? { selectedWorkspaceFingerprint: preferredWorkspaceFingerprint }
                                : {})}
                            selectedTagIds={selectedTagIds}
                            scopeFilter={scopeFilter}
                            {...(workspaceFilter ? { workspaceFilter } : {})}
                            sort={sort}
                            showAllModes={showAllModes}
                            groupView={groupView}
                            isAddingTag={isAddingTag}
                            {...(statusMessage ? { statusMessage, statusTone } : {})}
                            onSelectThread={onSelectThread}
                            {...(onPreviewThread ? { onPreviewThread } : {})}
                            onToggleTagFilter={onToggleTagFilter}
                            onToggleThreadFavorite={async (threadId, nextFavorite) => {
                                setFeedbackMessage(undefined);
                                try {
                                    await onToggleThreadFavorite(threadId, nextFavorite);
                                } catch (error) {
                                    const message =
                                        error instanceof Error ? error.message : 'Favorite status could not be updated.';
                                    setFeedbackMessage(message);
                                    throw error;
                                }
                            }}
                            onRequestWorkspaceDelete={(workspaceFingerprint, workspaceLabel) => {
                                setFeedbackMessage(undefined);
                                setIncludeFavoriteThreads(false);
                                setWorkspaceDeleteTarget({
                                    workspaceFingerprint,
                                    workspaceLabel,
                                });
                            }}
                            onRequestNewThread={(workspaceFingerprint) => {
                                onRequestNewThread(workspaceFingerprint ?? preferredWorkspaceFingerprint);
                            }}
                            onSelectWorkspaceFingerprint={onSelectWorkspaceFingerprint}
                            onScopeFilterChange={onScopeFilterChange}
                            onWorkspaceFilterChange={onWorkspaceFilterChange}
                            onSortChange={onSortChange}
                            onShowAllModesChange={onShowAllModesChange}
                            onGroupViewChange={onGroupViewChange}
                            onAddTagToThread={async (threadId, label) => {
                                setFeedbackMessage(undefined);
                                try {
                                    await onAddTagToThread(threadId, label);
                                } catch (error) {
                                    const message =
                                        error instanceof Error ? error.message : 'Thread tags could not be updated.';
                                    setFeedbackMessage(message);
                                    throw error;
                                }
                            }}
                        />
                    </>
                )}
            </aside>

            <WorkspaceDeleteDialog
                open={Boolean(workspaceDeleteTarget)}
                {...(workspaceDeleteTarget?.workspaceLabel ? { workspaceLabel: workspaceDeleteTarget.workspaceLabel } : {})}
                deletableThreadCount={workspaceDeletePreviewQuery.data?.deletableThreadCount ?? 0}
                favoriteThreadCount={workspaceDeletePreviewQuery.data?.favoriteThreadCount ?? 0}
                totalThreadCount={workspaceDeletePreviewQuery.data?.totalThreadCount ?? 0}
                busy={isDeletingWorkspaceThreads || workspaceDeletePreviewQuery.isLoading}
                includeFavoriteThreads={includeFavoriteThreads}
                onIncludeFavoriteThreadsChange={setIncludeFavoriteThreads}
                onCancel={() => {
                    setWorkspaceDeleteTarget(undefined);
                    setIncludeFavoriteThreads(false);
                }}
                onConfirm={() => {
                    if (!workspaceDeleteTarget) {
                        return;
                    }

                    setFeedbackMessage(undefined);
                    void onDeleteWorkspaceThreads({
                        workspaceFingerprint: workspaceDeleteTarget.workspaceFingerprint,
                        includeFavoriteThreads,
                    })
                        .then(() => {
                            setWorkspaceDeleteTarget(undefined);
                            setIncludeFavoriteThreads(false);
                        })
                        .catch((error) => {
                            setFeedbackMessage(
                                error instanceof Error ? error.message : 'Workspace threads could not be deleted.'
                            );
                        });
                }}
            />
        </>
    );
}
