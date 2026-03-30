import { useSidebarFavoriteMutationController } from '@/web/components/conversation/sidebar/useSidebarFavoriteMutationController';
import { useSidebarTagMutationController } from '@/web/components/conversation/sidebar/useSidebarTagMutationController';
import { useSidebarWorkspaceDeleteMutationController } from '@/web/components/conversation/sidebar/useSidebarWorkspaceDeleteMutationController';

import type {
    ConversationRecord,
    TagRecord,
    ThreadListRecord,
    ThreadRecord,
    ThreadTagRecord,
} from '@/app/backend/persistence/types';

import type { EntityId, TopLevelTab } from '@/shared/contracts';


interface SidebarThreadListQueryInput {
    profileId: string;
    activeTab: TopLevelTab;
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    scope?: 'workspace' | 'detached';
    workspaceFingerprint?: string;
    sort?: 'latest' | 'alphabetical';
}

interface UseSidebarMutationControllerInput {
    profileId: string;
    threadListQueryInput: SidebarThreadListQueryInput;
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTags: ThreadTagRecord[];
    threadTagIdsByThread: Map<string, string[]>;
    selectedThreadId: string | undefined;
    selectedSessionId: string | undefined;
    selectedRunId: string | undefined;
    onSelectThreadId: (threadId: string | undefined) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    upsertTag: (input: { profileId: string; label: string }) => Promise<{ tag: TagRecord }>;
    setThreadTags: (input: {
        profileId: string;
        threadId: EntityId<'thr'>;
        tagIds: EntityId<'tag'>[];
    }) => Promise<{ threadTags: ThreadTagRecord[] }>;
    setThreadFavorite: (input: {
        profileId: string;
        threadId: EntityId<'thr'>;
        isFavorite: boolean;
    }) => Promise<{ updated: boolean; thread?: ThreadRecord }>;
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
}

export function useSidebarMutationController(input: UseSidebarMutationControllerInput) {
    const selectedThread = input.threads.find((thread) => thread.id === input.selectedThreadId);
    const favoriteController = useSidebarFavoriteMutationController({
        profileId: input.profileId,
        threadListQueryInput: input.threadListQueryInput,
        threads: input.threads,
        setThreadFavorite: input.setThreadFavorite,
    });
    const tagController = useSidebarTagMutationController({
        profileId: input.profileId,
        threadTagIdsByThread: input.threadTagIdsByThread,
        upsertTag: input.upsertTag,
        setThreadTags: input.setThreadTags,
    });
    const workspaceDeleteController = useSidebarWorkspaceDeleteMutationController({
        profileId: input.profileId,
        threadListQueryInput: input.threadListQueryInput,
        buckets: input.buckets,
        threads: input.threads,
        tags: input.tags,
        threadTags: input.threadTags,
        selectedThreadId: input.selectedThreadId,
        selectedSessionId: input.selectedSessionId,
        selectedRunId: input.selectedRunId,
        selectedThread,
        onSelectThreadId: input.onSelectThreadId,
        onSelectSessionId: input.onSelectSessionId,
        onSelectRunId: input.onSelectRunId,
        deleteWorkspaceThreads: input.deleteWorkspaceThreads,
    });

    return {
        toggleThreadFavorite: favoriteController.toggleThreadFavorite,
        addTagToThread: tagController.addTagToThread,
        deleteWorkspaceThreadsForSidebar: workspaceDeleteController.deleteWorkspaceThreadsForSidebar,
    };
}

