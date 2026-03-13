import { FolderPlus, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';

import { SidebarRailHeader } from '@/web/components/conversation/sidebar/sections/sidebarRailHeader';
import { SidebarThreadBrowser } from '@/web/components/conversation/sidebar/sections/sidebarThreadBrowser';
import { WorkspaceDeleteDialog } from '@/web/components/conversation/sidebar/sections/workspaceDeleteDialog';
import { WorkspaceLifecycleDialog } from '@/web/components/conversation/sidebar/sections/workspaceLifecycleDialog';
import { resolveThreadDraftDefaults } from '@/web/components/conversation/sidebar/threadDraftDefaults';
import { Button } from '@/web/components/ui/button';
import { SECONDARY_QUERY_OPTIONS } from '@/web/lib/query/secondaryQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';
import type { SessionSummaryRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId, TopLevelTab } from '@/shared/contracts';

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
    isCreatingThread: boolean;
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
    onSelectWorkspaceFingerprint: (workspaceFingerprint: string | undefined) => void;
    onAddTagToThread: (threadId: string, label: string) => Promise<void>;
    onDeleteWorkspaceThreads: (input: {
        workspaceFingerprint: string;
        includeFavoriteThreads: boolean;
    }) => Promise<void>;
    onCreateThread: (input: {
        workspaceFingerprint: string;
        workspaceAbsolutePath: string;
        title: string;
        topLevelTab: TopLevelTab;
        providerId?: RuntimeProviderId;
        modelId?: string;
    }) => Promise<void>;
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
    isCreatingThread,
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
    onSelectWorkspaceFingerprint,
    onAddTagToThread,
    onDeleteWorkspaceThreads,
    onCreateThread,
}: ConversationSidebarProps) {
    const utils = trpc.useUtils();
    const shellBootstrapQuery = trpc.runtime.getShellBootstrap.useQuery({ profileId }, SECONDARY_QUERY_OPTIONS);
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [isWorkspaceCreateOpen, setIsWorkspaceCreateOpen] = useState(false);
    const [workspaceCreateError, setWorkspaceCreateError] = useState<string | undefined>(undefined);
    const [isPickingWorkspaceDirectory, setIsPickingWorkspaceDirectory] = useState(false);
    const [workspaceDeleteTarget, setWorkspaceDeleteTarget] = useState<
        | {
              workspaceFingerprint: string;
              workspaceLabel: string;
          }
        | undefined
    >(undefined);
    const [includeFavoriteThreads, setIncludeFavoriteThreads] = useState(false);
    const [inlineThreadDraft, setInlineThreadDraft] = useState<
        | {
              workspaceFingerprint: string;
              title: string;
              topLevelTab: TopLevelTab;
              providerId: RuntimeProviderId | undefined;
              modelId: string;
          }
        | undefined
    >(undefined);
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
    const registerWorkspaceRootMutation = trpc.runtime.registerWorkspaceRoot.useMutation();
    const setWorkspacePreferenceMutation = trpc.runtime.setWorkspacePreference.useMutation({
        onSuccess: ({ workspacePreference }) => {
            utils.runtime.getShellBootstrap.setData({ profileId }, (current) =>
                current
                    ? {
                          ...current,
                          workspacePreferences: [
                              workspacePreference,
                              ...current.workspacePreferences.filter(
                                  (record) => record.workspaceFingerprint !== workspacePreference.workspaceFingerprint
                              ),
                          ],
                      }
                    : current
            );
        },
    });
    const providers = shellBootstrapQuery.data?.providers ?? [];
    const providerModels = shellBootstrapQuery.data?.providerModels ?? [];
    const workspacePreferences = shellBootstrapQuery.data?.workspacePreferences ?? [];
    const defaults = shellBootstrapQuery.data?.defaults;
    const desktopBridge = typeof window !== 'undefined' ? window.neonDesktop : undefined;

    const openWorkspaceCreate = () => {
        setWorkspaceCreateError(undefined);
        setIsWorkspaceCreateOpen(true);
    };

    const startInlineThreadDraft = (workspaceFingerprint: string | undefined) => {
        if (!workspaceFingerprint) {
            return;
        }

        const nextDefaults = resolveThreadDraftDefaults({
            workspaceFingerprint,
            workspacePreferences,
            providers,
            providerModels,
            defaults,
            fallbackTopLevelTab: 'agent',
        });
        setInlineThreadDraft({
            workspaceFingerprint,
            title: '',
            topLevelTab: nextDefaults.topLevelTab,
            providerId: nextDefaults.providerId,
            modelId: nextDefaults.modelId,
        });
        onSelectWorkspaceFingerprint(workspaceFingerprint);
    };

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
                                onClick={openWorkspaceCreate}>
                                <FolderPlus className='h-4 w-4' />
                            </Button>
                        ) : (
                            <Button
                                type='button'
                                size='sm'
                                variant='secondary'
                                className='h-9 w-full rounded-xl whitespace-nowrap'
                                onClick={openWorkspaceCreate}>
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
                        providers={providers}
                        providerModels={providerModels}
                        isCreatingThread={
                            isCreatingThread ||
                            registerWorkspaceRootMutation.isPending ||
                            setWorkspacePreferenceMutation.isPending
                        }
                        {...(inlineThreadDraft ? { inlineThreadDraft } : {})}
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
                            startInlineThreadDraft(workspaceFingerprint ?? preferredWorkspaceFingerprint);
                        }}
                        onInlineThreadTitleChange={(title) => {
                            setInlineThreadDraft((current) => (current ? { ...current, title } : current));
                        }}
                        onInlineThreadTopLevelTabChange={(topLevelTab) => {
                            setInlineThreadDraft((current) => (current ? { ...current, topLevelTab } : current));
                        }}
                        onInlineThreadProviderChange={(providerId) => {
                            const nextModelId =
                                providerModels.find((model) => model.providerId === providerId)?.id ?? '';
                            setInlineThreadDraft((current) =>
                                current
                                    ? {
                                          ...current,
                                          providerId,
                                          modelId: nextModelId,
                                      }
                                    : current
                            );
                        }}
                        onInlineThreadModelChange={(modelId) => {
                            setInlineThreadDraft((current) => (current ? { ...current, modelId } : current));
                        }}
                        onCancelInlineThread={() => {
                            setInlineThreadDraft(undefined);
                        }}
                        onSubmitInlineThread={() => {
                            if (!inlineThreadDraft) {
                                return;
                            }

                            const workspaceRoot = workspaceRoots.find(
                                (workspace) => workspace.fingerprint === inlineThreadDraft.workspaceFingerprint
                            );
                            if (!workspaceRoot) {
                                setFeedbackMessage('Thread could not be created because the workspace is unresolved.');
                                return;
                            }

                            setFeedbackMessage(undefined);
                            void onCreateThread({
                                workspaceFingerprint: inlineThreadDraft.workspaceFingerprint,
                                workspaceAbsolutePath: workspaceRoot.absolutePath,
                                title: inlineThreadDraft.title,
                                topLevelTab: inlineThreadDraft.topLevelTab,
                                ...(inlineThreadDraft.providerId && inlineThreadDraft.modelId
                                    ? {
                                          providerId: inlineThreadDraft.providerId,
                                          modelId: inlineThreadDraft.modelId,
                                      }
                                    : {}),
                            })
                                .then(() => {
                                    setInlineThreadDraft(undefined);
                                })
                                .catch((error) => {
                                    setFeedbackMessage(
                                        error instanceof Error ? error.message : 'Thread could not be created.'
                                    );
                                });
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
                )}
            </aside>

            <WorkspaceLifecycleDialog
                open={isWorkspaceCreateOpen}
                providers={providers}
                providerModels={providerModels}
                workspacePreferences={workspacePreferences}
                defaults={defaults}
                busy={registerWorkspaceRootMutation.isPending || setWorkspacePreferenceMutation.isPending}
                isPickingDirectory={isPickingWorkspaceDirectory}
                {...(workspaceCreateError ? { statusMessage: workspaceCreateError } : {})}
                onClose={() => {
                    setWorkspaceCreateError(undefined);
                    setIsWorkspaceCreateOpen(false);
                }}
                onBrowseDirectory={async () => {
                    if (!desktopBridge || isPickingWorkspaceDirectory) {
                        return undefined;
                    }

                    setIsPickingWorkspaceDirectory(true);
                    try {
                        const result = await desktopBridge.pickDirectory();
                        return result.canceled ? undefined : result.absolutePath;
                    } finally {
                        setIsPickingWorkspaceDirectory(false);
                    }
                }}
                onSubmit={async (input) => {
                    setWorkspaceCreateError(undefined);
                    setFeedbackMessage(undefined);
                    try {
                        const result = await registerWorkspaceRootMutation.mutateAsync({
                            profileId,
                            absolutePath: input.absolutePath,
                            label: input.label,
                        });

                        utils.runtime.listWorkspaceRoots.setData({ profileId }, (current) => ({
                            workspaceRoots: current
                                ? [
                                      result.workspaceRoot,
                                      ...current.workspaceRoots.filter(
                                          (workspaceRoot) =>
                                              workspaceRoot.fingerprint !== result.workspaceRoot.fingerprint
                                      ),
                                  ]
                                : [result.workspaceRoot],
                        }));
                        utils.runtime.getShellBootstrap.setData({ profileId }, (current) =>
                            current
                                ? {
                                      ...current,
                                      workspaceRoots: [
                                          result.workspaceRoot,
                                          ...current.workspaceRoots.filter(
                                              (workspaceRoot) =>
                                                  workspaceRoot.fingerprint !== result.workspaceRoot.fingerprint
                                          ),
                                      ],
                                  }
                                : current
                        );

                        await setWorkspacePreferenceMutation.mutateAsync({
                            profileId,
                            workspaceFingerprint: result.workspaceRoot.fingerprint,
                            defaultTopLevelTab: input.defaultTopLevelTab,
                            ...(input.defaultProviderId
                                ? {
                                      defaultProviderId: input.defaultProviderId,
                                      defaultModelId: input.defaultModelId,
                                  }
                                : {}),
                        });

                        onSelectWorkspaceFingerprint(result.workspaceRoot.fingerprint);
                        setIsWorkspaceCreateOpen(false);
                        try {
                            await onCreateThread({
                                workspaceFingerprint: result.workspaceRoot.fingerprint,
                                workspaceAbsolutePath: result.workspaceRoot.absolutePath,
                                title: '',
                                topLevelTab: input.defaultTopLevelTab,
                                ...(input.defaultProviderId && input.defaultModelId
                                    ? {
                                          providerId: input.defaultProviderId,
                                          modelId: input.defaultModelId,
                                      }
                                    : {}),
                            });
                        } catch (error) {
                            const message =
                                error instanceof Error
                                    ? error.message
                                    : 'Workspace was created, but the starter thread could not be created.';
                            setFeedbackMessage(message);
                            startInlineThreadDraft(result.workspaceRoot.fingerprint);
                        }
                    } catch (error) {
                        setWorkspaceCreateError(
                            error instanceof Error ? error.message : 'Workspace could not be created.'
                        );
                    }
                }}
            />

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
