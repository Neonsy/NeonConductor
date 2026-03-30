import { removeDeletedSidebarRecords } from '@/web/components/conversation/sidebar/sidebarCache';
import { sidebarMutationFailure, sidebarMutationSuccess } from '@/web/components/conversation/sidebar/sidebarMutationResult';
import type { SidebarMutationResult } from '@/web/components/conversation/sidebar/sidebarMutationResult';
import { resolveSidebarSelectionAfterMutation } from '@/web/components/conversation/sidebar/useSidebarMutationOutcomeHandler';
import { trpc } from '@/web/trpc/client';

import type {
    ConversationRecord,
    SessionSummaryRecord,
    TagRecord,
    ThreadListRecord,
    ThreadTagRecord,
} from '@/app/backend/persistence/types';

import type { TopLevelTab } from '@/shared/contracts';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;
type ThreadListData = Awaited<ReturnType<TrpcUtils['conversation']['listThreads']['fetch']>>;

interface SidebarThreadListQueryInput {
    profileId: string;
    activeTab: TopLevelTab;
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    scope?: 'workspace' | 'detached';
    workspaceFingerprint?: string;
    sort?: 'latest' | 'alphabetical';
}

interface DeleteWorkspaceThreadsInput {
    utils: TrpcUtils;
    profileId: string;
    threadListQueryInput: SidebarThreadListQueryInput;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTags: ThreadTagRecord[];
    selectedThreadId: string | undefined;
    selectedSessionId: string | undefined;
    selectedRunId: string | undefined;
    selectedThread: ThreadListRecord | undefined;
    onSelectThreadId: (threadId: string | undefined) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    deleteWorkspaceThreads: (input: {
        profileId: string;
        workspaceFingerprint: string;
        includeFavorites?: boolean;
    }) => Promise<{
        deletedThreadIds: string[];
        deletedTagIds: string[];
        deletedConversationIds: string[];
        sessionIds: string[];
    }>;
    workspaceFingerprint: string;
    includeFavoriteThreads: boolean;
}

export async function deleteSidebarWorkspaceThreads(input: DeleteWorkspaceThreadsInput): Promise<SidebarMutationResult> {
    const failureMessage = 'Workspace threads could not be deleted.';
    const previousBucketList = input.utils.conversation.listBuckets.getData({ profileId: input.profileId });
    const previousThreadList = input.utils.conversation.listThreads.getData(input.threadListQueryInput);
    const previousTagList = input.utils.conversation.listTags.getData({ profileId: input.profileId });
    const previousShellBootstrap = input.utils.runtime.getShellBootstrap.getData({ profileId: input.profileId });
    const previousSessionList = input.utils.session.list.getData({ profileId: input.profileId });

    try {
        const result = await input.deleteWorkspaceThreads({
            profileId: input.profileId,
            workspaceFingerprint: input.workspaceFingerprint,
            includeFavorites: input.includeFavoriteThreads,
        });

        const nextSelection = resolveSidebarSelectionAfterMutation({
            selectedThreadId: input.selectedThreadId,
            selectedSessionId: input.selectedSessionId,
            selectedRunId: input.selectedRunId,
            selectedThread: input.selectedThread,
            outcome: {
                kind: 'deleted_workspace_threads',
                workspaceFingerprint: input.workspaceFingerprint,
                deletedThreadIds: result.deletedThreadIds,
                deletedSessionIds: result.sessionIds,
                deletedConversationIds: result.deletedConversationIds,
                deletedTagIds: result.deletedTagIds,
            },
        });

        input.onSelectThreadId(nextSelection.selectedThreadId);
        input.onSelectSessionId(nextSelection.selectedSessionId);
        input.onSelectRunId(nextSelection.selectedRunId);

        const deletedSidebarRecords = removeDeletedSidebarRecords({
            buckets: input.buckets,
            threads: input.threads,
            tags: input.tags,
            threadTags: input.threadTags,
            deletedThreadIds: result.deletedThreadIds,
            deletedTagIds: result.deletedTagIds,
            deletedConversationIds: result.deletedConversationIds,
        });

        input.utils.conversation.listBuckets.setData(
            { profileId: input.profileId },
            {
                buckets: deletedSidebarRecords.buckets,
            }
        );
        input.utils.conversation.listThreads.setData(input.threadListQueryInput, (current: ThreadListData | undefined) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                threads: deletedSidebarRecords.threads,
            };
        });
        input.utils.conversation.listTags.setData(
            { profileId: input.profileId },
            {
                tags: deletedSidebarRecords.tags,
            }
        );
        if (previousShellBootstrap) {
            input.utils.runtime.getShellBootstrap.setData(
                { profileId: input.profileId },
                {
                    ...previousShellBootstrap,
                    threadTags: deletedSidebarRecords.threadTags,
                }
            );
        }
        if (previousSessionList) {
            input.utils.session.list.setData(
                { profileId: input.profileId },
                {
                    sessions: previousSessionList.sessions.filter(
                        (session: SessionSummaryRecord) => !result.sessionIds.includes(session.id)
                    ),
                }
            );
        }

        return sidebarMutationSuccess();
    } catch (error) {
        if (previousBucketList) {
            input.utils.conversation.listBuckets.setData({ profileId: input.profileId }, previousBucketList);
        }
        if (previousThreadList) {
            input.utils.conversation.listThreads.setData(input.threadListQueryInput, previousThreadList);
        }
        if (previousTagList) {
            input.utils.conversation.listTags.setData({ profileId: input.profileId }, previousTagList);
        }
        if (previousShellBootstrap) {
            input.utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, previousShellBootstrap);
        }
        if (previousSessionList) {
            input.utils.session.list.setData({ profileId: input.profileId }, previousSessionList);
        }
        return sidebarMutationFailure(error instanceof Error ? error.message : failureMessage);
    }
}

interface UseSidebarWorkspaceDeleteMutationControllerInput {
    profileId: string;
    threadListQueryInput: SidebarThreadListQueryInput;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTags: ThreadTagRecord[];
    selectedThreadId: string | undefined;
    selectedSessionId: string | undefined;
    selectedRunId: string | undefined;
    selectedThread: ThreadListRecord | undefined;
    onSelectThreadId: (threadId: string | undefined) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    deleteWorkspaceThreads: DeleteWorkspaceThreadsInput['deleteWorkspaceThreads'];
}

export function useSidebarWorkspaceDeleteMutationController(
    input: UseSidebarWorkspaceDeleteMutationControllerInput
) {
    const utils = trpc.useUtils();

    return {
        deleteWorkspaceThreadsForSidebar(args: {
            workspaceFingerprint: string;
            includeFavoriteThreads: boolean;
        }) {
            return deleteSidebarWorkspaceThreads({
                utils,
                profileId: input.profileId,
                threadListQueryInput: input.threadListQueryInput,
                buckets: input.buckets,
                threads: input.threads,
                tags: input.tags,
                threadTags: input.threadTags,
                selectedThreadId: input.selectedThreadId,
                selectedSessionId: input.selectedSessionId,
                selectedRunId: input.selectedRunId,
                selectedThread: input.selectedThread,
                onSelectThreadId: input.onSelectThreadId,
                onSelectSessionId: input.onSelectSessionId,
                onSelectRunId: input.onSelectRunId,
                deleteWorkspaceThreads: input.deleteWorkspaceThreads,
                workspaceFingerprint: args.workspaceFingerprint,
                includeFavoriteThreads: args.includeFavoriteThreads,
            });
        },
    };
}
