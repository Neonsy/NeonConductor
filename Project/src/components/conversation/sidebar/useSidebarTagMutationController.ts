import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import {
    replaceThreadTagRelations,
    upsertTagRecord,
} from '@/web/components/conversation/sidebar/sidebarCache';
import {
    sidebarMutationFailure,
    sidebarMutationSuccess,
} from '@/web/components/conversation/sidebar/sidebarMutationResult';
import type { SidebarMutationResult } from '@/web/components/conversation/sidebar/sidebarMutationResult';
import { trpc } from '@/web/trpc/client';

import type { TagRecord, ThreadTagRecord } from '@/app/backend/persistence/types';

import type { EntityId } from '@/shared/contracts';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;
type ShellBootstrapData = Awaited<ReturnType<TrpcUtils['runtime']['getShellBootstrap']['fetch']>>;

interface AddTagToThreadInput {
    utils: TrpcUtils;
    profileId: string;
    threadTagIdsByThread: Map<string, string[]>;
    upsertTag: (input: { profileId: string; label: string }) => Promise<{ tag: TagRecord }>;
    setThreadTags: (input: {
        profileId: string;
        threadId: EntityId<'thr'>;
        tagIds: EntityId<'tag'>[];
    }) => Promise<{ threadTags: ThreadTagRecord[] }>;
    threadId: string;
    label: string;
}

export async function addSidebarTagToThread(input: AddTagToThreadInput): Promise<SidebarMutationResult> {
    const failureMessage = 'Thread tags could not be updated.';
    if (!isEntityId(input.threadId, 'thr')) {
        return sidebarMutationFailure(failureMessage);
    }

    const previousTags = input.utils.conversation.listTags.getData({ profileId: input.profileId });
    const previousShellBootstrap = input.utils.runtime.getShellBootstrap.getData({ profileId: input.profileId });

    try {
        const upserted = await input.upsertTag({
            profileId: input.profileId,
            label: input.label,
        });
        const existingTagIds = input.threadTagIdsByThread.get(input.threadId) ?? [];
        const nextTagIds = [...new Set([...existingTagIds, upserted.tag.id])];
        const validTagIds = nextTagIds.filter((tagId): tagId is EntityId<'tag'> => isEntityId(tagId, 'tag'));
        if (validTagIds.length !== nextTagIds.length) {
            return sidebarMutationFailure('The selected tag could not be applied to this thread.');
        }

        input.utils.conversation.listTags.setData({ profileId: input.profileId }, (current) => {
            if (!current) {
                return current;
            }

            return {
                tags: upsertTagRecord(current.tags, upserted.tag),
            };
        });
        input.utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, (current: ShellBootstrapData | undefined) => {
            if (!current) {
                return current;
            }

            const optimisticThreadTags: ThreadTagRecord[] = validTagIds.map((tagId) => ({
                profileId: input.profileId,
                threadId: input.threadId,
                tagId,
                createdAt: new Date().toISOString(),
            }));

            return {
                ...current,
                threadTags: replaceThreadTagRelations(current.threadTags, input.threadId, optimisticThreadTags),
            };
        });

        const result = await input.setThreadTags({
            profileId: input.profileId,
            threadId: input.threadId,
            tagIds: validTagIds,
        });
        input.utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, (current: ShellBootstrapData | undefined) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                threadTags: replaceThreadTagRelations(current.threadTags, input.threadId, result.threadTags),
            };
        });
        return sidebarMutationSuccess();
    } catch (error) {
        if (previousTags) {
            input.utils.conversation.listTags.setData({ profileId: input.profileId }, previousTags);
        }
        if (previousShellBootstrap) {
            input.utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, previousShellBootstrap);
        }
        return sidebarMutationFailure(error instanceof Error ? error.message : failureMessage);
    }
}

interface UseSidebarTagMutationControllerInput {
    profileId: string;
    threadTagIdsByThread: Map<string, string[]>;
    upsertTag: AddTagToThreadInput['upsertTag'];
    setThreadTags: AddTagToThreadInput['setThreadTags'];
}

export function useSidebarTagMutationController(input: UseSidebarTagMutationControllerInput) {
    const utils = trpc.useUtils();

    return {
        addTagToThread(threadId: string, label: string) {
            return addSidebarTagToThread({
                utils,
                profileId: input.profileId,
                threadTagIdsByThread: input.threadTagIdsByThread,
                upsertTag: input.upsertTag,
                setThreadTags: input.setThreadTags,
                threadId,
                label,
            });
        },
    };
}
