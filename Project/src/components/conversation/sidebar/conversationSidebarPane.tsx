import { useState } from 'react';

import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import { resolveTabSwitchNotice } from '@/web/components/conversation/shell/workspace/tabSwitch';
import { ConversationSidebar } from '@/web/components/conversation/sidebar/sidebar';
import { ConfirmDialog } from '@/web/components/ui/confirmDialog';
import { trpc } from '@/web/trpc/client';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';
import type { EntityId, TopLevelTab } from '@/app/backend/runtime/contracts';

interface ConversationSidebarPaneProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTagIdsByThread: Map<string, string[]>;
    selectedThreadId: string | undefined;
    selectedTagIds: string[];
    scopeFilter: 'all' | 'workspace' | 'detached';
    workspaceFilter: string | undefined;
    sort: 'latest' | 'alphabetical';
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    isCreatingThread: boolean;
    isAddingTag: boolean;
    isDeletingWorkspaceThreads: boolean;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onSetTabSwitchNotice: (nextNotice: string | undefined) => void;
    onSelectThreadId: (threadId: string | undefined) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    onSelectTagIds: (tagIds: string[] | ((current: string[]) => string[])) => void;
    onScopeFilterChange: (scope: 'all' | 'workspace' | 'detached') => void;
    onWorkspaceFilterChange: (workspaceFingerprint?: string) => void;
    onSortChange: (sort: 'latest' | 'alphabetical') => void;
    onShowAllModesChange: (showAllModes: boolean) => void;
    onGroupViewChange: (groupView: 'workspace' | 'branch') => void;
    createThread: (input: {
        profileId: string;
        topLevelTab: TopLevelTab;
        scope: 'detached' | 'workspace';
        workspacePath?: string;
        title: string;
    }) => Promise<{ thread: { id: string } }>;
    upsertTag: (input: { profileId: string; label: string }) => Promise<{ tag: { id: string } }>;
    setThreadTags: (input: { profileId: string; threadId: EntityId<'thr'>; tagIds: EntityId<'tag'>[] }) => Promise<unknown>;
    setThreadFavorite: (input: {
        profileId: string;
        threadId: EntityId<'thr'>;
        isFavorite: boolean;
    }) => Promise<unknown>;
    deleteWorkspaceThreads: (input: {
        profileId: string;
        workspaceFingerprint: string;
        includeFavorites?: boolean;
    }) => Promise<{ deletedThreadIds: string[] }>;
    refetchBuckets: () => Promise<unknown>;
    refetchThreads: () => Promise<unknown>;
    refetchTags: () => Promise<unknown>;
    refetchShellBootstrap: () => Promise<unknown>;
    refetchSessions: () => Promise<unknown>;
}

export function ConversationSidebarPane({
    profileId,
    topLevelTab,
    buckets,
    threads,
    tags,
    threadTagIdsByThread,
    selectedThreadId,
    selectedTagIds,
    scopeFilter,
    workspaceFilter,
    sort,
    showAllModes,
    groupView,
    isCreatingThread,
    isAddingTag,
    isDeletingWorkspaceThreads,
    onTopLevelTabChange,
    onSetTabSwitchNotice,
    onSelectThreadId,
    onSelectSessionId,
    onSelectRunId,
    onSelectTagIds,
    onScopeFilterChange,
    onWorkspaceFilterChange,
    onSortChange,
    onShowAllModesChange,
    onGroupViewChange,
    createThread,
    upsertTag,
    setThreadTags,
    setThreadFavorite,
    deleteWorkspaceThreads,
    refetchBuckets,
    refetchThreads,
    refetchTags,
    refetchShellBootstrap,
    refetchSessions,
}: ConversationSidebarPaneProps) {
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [optimisticFavoriteByThreadId, setOptimisticFavoriteByThreadId] = useState<Record<string, boolean>>({});
    const [optimisticTagIdsByThreadId, setOptimisticTagIdsByThreadId] = useState<Record<string, string[]>>({});
    const [workspaceDeleteTarget, setWorkspaceDeleteTarget] = useState<
        | {
              workspaceFingerprint: string;
              workspaceLabel: string;
          }
        | undefined
    >(undefined);
    const [includeFavoriteThreads, setIncludeFavoriteThreads] = useState(false);
    const visibleThreads = threads.map((thread) => ({
        ...thread,
        ...(optimisticFavoriteByThreadId[thread.id] !== undefined
            ? { isFavorite: optimisticFavoriteByThreadId[thread.id] }
            : {}),
    }));
    const visibleThreadTagIdsByThread = new Map(threadTagIdsByThread);
    for (const [threadId, tagIds] of Object.entries(optimisticTagIdsByThreadId)) {
        visibleThreadTagIdsByThread.set(threadId, tagIds);
    }
    const selectedThread = visibleThreads.find((thread) => thread.id === selectedThreadId);
    const workspaceDeletePreviewQuery = trpc.conversation.getWorkspaceThreadDeletePreview.useQuery(
        {
            profileId,
            workspaceFingerprint: workspaceDeleteTarget?.workspaceFingerprint ?? '',
            includeFavorites: includeFavoriteThreads,
        },
        {
            enabled: Boolean(workspaceDeleteTarget),
            refetchOnWindowFocus: false,
        }
    );

    return (
        <>
            <ConversationSidebar
                buckets={buckets}
                threads={visibleThreads}
                tags={tags}
                threadTagIdsByThread={visibleThreadTagIdsByThread}
                topLevelTab={topLevelTab}
                {...(selectedThreadId ? { selectedThreadId } : {})}
                selectedTagIds={selectedTagIds}
                scopeFilter={scopeFilter}
                {...(workspaceFilter ? { workspaceFilter } : {})}
                sort={sort}
                showAllModes={showAllModes}
                groupView={groupView}
                isCreatingThread={isCreatingThread}
                isAddingTag={isAddingTag}
                {...(feedbackMessage ? { feedbackMessage } : {})}
                onSelectThread={(threadId) => {
                    const targetThread = visibleThreads.find((thread) => thread.id === threadId);
                    const nextTab = targetThread?.topLevelTab ?? topLevelTab;
                    const switchState = resolveTabSwitchNotice(topLevelTab, nextTab);
                    if (switchState.shouldSwitch) {
                        onTopLevelTabChange(nextTab);
                        onSetTabSwitchNotice(switchState.notice);
                        window.setTimeout(() => {
                            onSetTabSwitchNotice(undefined);
                        }, 2200);
                    } else {
                        onSetTabSwitchNotice(undefined);
                    }
                    onSelectThreadId(threadId);
                }}
                onToggleTagFilter={(tagId) => {
                    onSelectTagIds((current) =>
                        current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]
                    );
                }}
                onToggleThreadFavorite={(threadId, nextFavorite) => {
                    if (!isEntityId(threadId, 'thr')) {
                        return;
                    }

                    void (async () => {
                        setFeedbackMessage(undefined);
                        setOptimisticFavoriteByThreadId((current) => ({
                            ...current,
                            [threadId]: nextFavorite,
                        }));

                        try {
                            await setThreadFavorite({
                                profileId,
                                threadId,
                                isFavorite: nextFavorite,
                            });
                            await refetchThreads();
                        } catch (error) {
                            setFeedbackMessage(
                                error instanceof Error ? error.message : 'Favorite status could not be updated.'
                            );
                        } finally {
                            setOptimisticFavoriteByThreadId((current) => {
                                const nextState = { ...current };
                                delete nextState[threadId];
                                return nextState;
                            });
                        }
                    })();
                }}
                onRequestWorkspaceDelete={(workspaceFingerprint, workspaceLabel) => {
                    setIncludeFavoriteThreads(false);
                    setWorkspaceDeleteTarget({
                        workspaceFingerprint,
                        workspaceLabel,
                    });
                }}
                onScopeFilterChange={onScopeFilterChange}
                onWorkspaceFilterChange={onWorkspaceFilterChange}
                onSortChange={onSortChange}
                onShowAllModesChange={onShowAllModesChange}
                onGroupViewChange={onGroupViewChange}
                onCreateThread={async (input) => {
                    const result = await createThread({
                        profileId,
                        topLevelTab,
                        ...input,
                    });
                    onSelectThreadId(result.thread.id);
                    onSelectSessionId(undefined);
                    onSelectRunId(undefined);
                    await Promise.all([refetchBuckets(), refetchThreads()]);
                }}
                onAddTagToThread={async (threadId, label) => {
                    if (!isEntityId(threadId, 'thr')) {
                        return;
                    }

                    setFeedbackMessage(undefined);

                    try {
                        const upserted = await upsertTag({
                            profileId,
                            label,
                        });
                        const existingTagIds = visibleThreadTagIdsByThread.get(threadId) ?? [];
                        const nextTagIds = [...new Set([...existingTagIds, upserted.tag.id])];
                        const validTagIds = nextTagIds.filter(
                            (tagId): tagId is EntityId<'tag'> => isEntityId(tagId, 'tag')
                        );
                        if (validTagIds.length !== nextTagIds.length) {
                            setFeedbackMessage('The selected tag could not be applied to this thread.');
                            return;
                        }

                        setOptimisticTagIdsByThreadId((current) => ({
                            ...current,
                            [threadId]: validTagIds,
                        }));

                        await setThreadTags({
                            profileId,
                            threadId,
                            tagIds: validTagIds,
                        });
                        await Promise.all([refetchTags(), refetchShellBootstrap()]);
                    } catch (error) {
                        setFeedbackMessage(error instanceof Error ? error.message : 'Thread tags could not be updated.');
                    } finally {
                        setOptimisticTagIdsByThreadId((current) => {
                            const nextState = { ...current };
                            delete nextState[threadId];
                            return nextState;
                        });
                    }
                }}
            />
            <ConfirmDialog
                open={Boolean(workspaceDeleteTarget)}
                title='Clear workspace threads'
                message={
                    workspaceDeleteTarget
                        ? `Delete threads for ${workspaceDeleteTarget.workspaceLabel}. Favorites are protected unless you explicitly include them.`
                        : ''
                }
                confirmLabel='Delete threads'
                destructive
                busy={isDeletingWorkspaceThreads || workspaceDeletePreviewQuery.isLoading}
                confirmDisabled={(workspaceDeletePreviewQuery.data?.deletableThreadCount ?? 0) === 0}
                onCancel={() => {
                    setWorkspaceDeleteTarget(undefined);
                    setIncludeFavoriteThreads(false);
                }}
                onConfirm={() => {
                    if (!workspaceDeleteTarget) {
                        return;
                    }

                    void (async () => {
                        try {
                            const result = await deleteWorkspaceThreads({
                                profileId,
                                workspaceFingerprint: workspaceDeleteTarget.workspaceFingerprint,
                                includeFavorites: includeFavoriteThreads,
                            });
                            if (selectedThreadId && result.deletedThreadIds.includes(selectedThreadId)) {
                                onSelectThreadId(undefined);
                                onSelectSessionId(undefined);
                                onSelectRunId(undefined);
                            } else if (
                                selectedThread &&
                                selectedThread.workspaceFingerprint === workspaceDeleteTarget.workspaceFingerprint &&
                                result.deletedThreadIds.length > 0
                            ) {
                                onSelectSessionId(undefined);
                                onSelectRunId(undefined);
                            }

                            setWorkspaceDeleteTarget(undefined);
                            setIncludeFavoriteThreads(false);
                            await Promise.all([
                                refetchBuckets(),
                                refetchThreads(),
                                refetchTags(),
                                refetchShellBootstrap(),
                                refetchSessions(),
                            ]);
                        } catch (error) {
                            setFeedbackMessage(
                                error instanceof Error
                                    ? error.message
                                    : 'Workspace threads could not be deleted.'
                            );
                        }
                    })();
                }}>
                <div className='space-y-3 text-sm'>
                    <div className='rounded-lg border border-amber-500/20 bg-amber-500/5 p-3'>
                        <p className='font-medium text-foreground'>
                            {workspaceDeletePreviewQuery.data?.deletableThreadCount ?? 0} thread
                            {(workspaceDeletePreviewQuery.data?.deletableThreadCount ?? 0) === 1 ? '' : 's'} will be
                            deleted.
                        </p>
                        <p className='text-muted-foreground mt-1 text-xs'>
                            {workspaceDeletePreviewQuery.data?.favoriteThreadCount ?? 0} favorite
                            {(workspaceDeletePreviewQuery.data?.favoriteThreadCount ?? 0) === 1 ? '' : 's'} detected out
                            of {workspaceDeletePreviewQuery.data?.totalThreadCount ?? 0} total workspace threads.
                        </p>
                    </div>
                    {(workspaceDeletePreviewQuery.data?.favoriteThreadCount ?? 0) > 0 ? (
                        <label className='flex items-start gap-2'>
                            <input
                                type='checkbox'
                                className='mt-0.5'
                                checked={includeFavoriteThreads}
                                onChange={(event) => {
                                    setIncludeFavoriteThreads(event.target.checked);
                                }}
                            />
                            <span>
                                Also delete favorite threads
                                <span className='text-muted-foreground block text-xs'>
                                    Default is safe: favorites stay unless you check this.
                                </span>
                            </span>
                        </label>
                    ) : null}
                </div>
            </ConfirmDialog>
        </>
    );
}
