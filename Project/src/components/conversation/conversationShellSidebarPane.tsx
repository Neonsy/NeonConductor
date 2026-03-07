import { isEntityId } from '@/web/components/conversation/shellHelpers';
import { resolveTabSwitchNotice } from '@/web/components/conversation/shellTabSwitch';
import { ConversationSidebar } from '@/web/components/conversation/sidebar';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';
import type { EntityId, TopLevelTab } from '@/app/backend/runtime/contracts';

interface ConversationShellSidebarPaneProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTagIdsByThread: Map<string, string[]>;
    selectedThreadId: string | undefined;
    selectedTagId: string | undefined;
    scopeFilter: 'all' | 'workspace' | 'detached';
    workspaceFilter: string | undefined;
    sort: 'latest' | 'alphabetical';
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    isCreatingThread: boolean;
    isAddingTag: boolean;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onSetTabSwitchNotice: (nextNotice: string | undefined) => void;
    onSelectThreadId: (threadId: string | undefined) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    onSelectTagId: (tagId: string | undefined | ((current: string | undefined) => string | undefined)) => void;
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
    refetchBuckets: () => Promise<unknown>;
    refetchThreads: () => Promise<unknown>;
    refetchTags: () => Promise<unknown>;
    refetchShellBootstrap: () => Promise<unknown>;
}

export function ConversationShellSidebarPane({
    profileId,
    topLevelTab,
    buckets,
    threads,
    tags,
    threadTagIdsByThread,
    selectedThreadId,
    selectedTagId,
    scopeFilter,
    workspaceFilter,
    sort,
    showAllModes,
    groupView,
    isCreatingThread,
    isAddingTag,
    onTopLevelTabChange,
    onSetTabSwitchNotice,
    onSelectThreadId,
    onSelectSessionId,
    onSelectRunId,
    onSelectTagId,
    onScopeFilterChange,
    onWorkspaceFilterChange,
    onSortChange,
    onShowAllModesChange,
    onGroupViewChange,
    createThread,
    upsertTag,
    setThreadTags,
    refetchBuckets,
    refetchThreads,
    refetchTags,
    refetchShellBootstrap,
}: ConversationShellSidebarPaneProps) {
    return (
        <ConversationSidebar
            buckets={buckets}
            threads={threads}
            tags={tags}
            threadTagIdsByThread={threadTagIdsByThread}
            topLevelTab={topLevelTab}
            {...(selectedThreadId ? { selectedThreadId } : {})}
            {...(selectedTagId ? { selectedTagId } : {})}
            scopeFilter={scopeFilter}
            {...(workspaceFilter ? { workspaceFilter } : {})}
            sort={sort}
            showAllModes={showAllModes}
            groupView={groupView}
            isCreatingThread={isCreatingThread}
            isAddingTag={isAddingTag}
            onSelectThread={(threadId) => {
                const targetThread = threads.find((thread) => thread.id === threadId);
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
                onSelectTagId((current) => (current === tagId ? undefined : tagId));
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

                const upserted = await upsertTag({
                    profileId,
                    label,
                });
                const existing = threadTagIdsByThread.get(threadId) ?? [];
                const nextTagIds = [...new Set([...existing, upserted.tag.id])];
                const validTagIds = nextTagIds.filter((tagId): tagId is EntityId<'tag'> => isEntityId(tagId, 'tag'));
                if (validTagIds.length !== nextTagIds.length) {
                    return;
                }

                await setThreadTags({
                    profileId,
                    threadId,
                    tagIds: validTagIds,
                });
                await Promise.all([refetchTags(), refetchShellBootstrap()]);
            }}
        />
    );
}
