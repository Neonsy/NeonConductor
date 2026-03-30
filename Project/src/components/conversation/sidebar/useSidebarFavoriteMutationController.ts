import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import { patchThreadListRecord } from '@/web/components/conversation/sidebar/sidebarCache';
import {
    sidebarMutationFailure,
    sidebarMutationSuccess,
} from '@/web/components/conversation/sidebar/sidebarMutationResult';
import type { SidebarMutationResult } from '@/web/components/conversation/sidebar/sidebarMutationResult';
import { trpc } from '@/web/trpc/client';

import type { ThreadListRecord, ThreadRecord } from '@/app/backend/persistence/types';

import type { EntityId, TopLevelTab } from '@/shared/contracts';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

interface SidebarThreadListQueryInput {
    profileId: string;
    activeTab: TopLevelTab;
    showAllModes: boolean;
    groupView: 'workspace' | 'branch';
    scope?: 'workspace' | 'detached';
    workspaceFingerprint?: string;
    sort?: 'latest' | 'alphabetical';
}

interface ToggleThreadFavoriteInput {
    utils: TrpcUtils;
    profileId: string;
    threadListQueryInput: SidebarThreadListQueryInput;
    threads: ThreadListRecord[];
    setThreadFavorite: (input: {
        profileId: string;
        threadId: EntityId<'thr'>;
        isFavorite: boolean;
    }) => Promise<{ updated: boolean; thread?: ThreadRecord }>;
    threadId: string;
    nextFavorite: boolean;
}

export async function toggleSidebarThreadFavorite(input: ToggleThreadFavoriteInput): Promise<SidebarMutationResult> {
    const failureMessage = 'Favorite status could not be updated.';
    if (!isEntityId(input.threadId, 'thr')) {
        return sidebarMutationFailure(failureMessage);
    }

    const currentThread = input.threads.find((thread) => thread.id === input.threadId);
    if (!currentThread) {
        return sidebarMutationFailure(failureMessage);
    }

    const previousThreadList = input.utils.conversation.listThreads.getData(input.threadListQueryInput);
    input.utils.conversation.listThreads.setData(input.threadListQueryInput, (current) => {
        if (!current) {
            return current;
        }

        return {
            ...current,
            threads: patchThreadListRecord(current.threads, {
                ...currentThread,
                isFavorite: input.nextFavorite,
            }),
        };
    });

    try {
        const result = await input.setThreadFavorite({
            profileId: input.profileId,
            threadId: input.threadId,
            isFavorite: input.nextFavorite,
        });
        const updatedThread = result.thread;
        if (!result.updated || !updatedThread) {
            if (previousThreadList) {
                input.utils.conversation.listThreads.setData(input.threadListQueryInput, previousThreadList);
            }
            return sidebarMutationFailure(failureMessage);
        }

        input.utils.conversation.listThreads.setData(input.threadListQueryInput, (current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                threads: patchThreadListRecord(current.threads, updatedThread),
            };
        });
        return sidebarMutationSuccess();
    } catch (error) {
        if (previousThreadList) {
            input.utils.conversation.listThreads.setData(input.threadListQueryInput, previousThreadList);
        }
        return sidebarMutationFailure(error instanceof Error ? error.message : failureMessage);
    }
}

interface UseSidebarFavoriteMutationControllerInput {
    profileId: string;
    threadListQueryInput: SidebarThreadListQueryInput;
    threads: ThreadListRecord[];
    setThreadFavorite: ToggleThreadFavoriteInput['setThreadFavorite'];
}

export function useSidebarFavoriteMutationController(input: UseSidebarFavoriteMutationControllerInput) {
    const utils = trpc.useUtils();

    return {
        toggleThreadFavorite(threadId: string, nextFavorite: boolean) {
            return toggleSidebarThreadFavorite({
                utils,
                profileId: input.profileId,
                threadListQueryInput: input.threadListQueryInput,
                threads: input.threads,
                setThreadFavorite: input.setThreadFavorite,
                threadId,
                nextFavorite,
            });
        },
    };
}
