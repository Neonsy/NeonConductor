import { conversationStore, settingsStore, tagStore, threadStore } from '@/app/backend/persistence/stores';
import {
    conversationCreateThreadInputSchema,
    conversationListBucketsInputSchema,
    conversationListTagsInputSchema,
    conversationListThreadsInputSchema,
    conversationRenameThreadInputSchema,
    conversationSetThreadTagsInputSchema,
    conversationUpsertTagInputSchema,
} from '@/app/backend/runtime/contracts';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

const THREAD_SORT_SETTING_KEY = 'conversation_thread_sort';
const DEFAULT_THREAD_SORT = 'latest' as const;

function isThreadSort(value: string | undefined): value is 'latest' | 'alphabetical' {
    return value === 'latest' || value === 'alphabetical';
}

export const conversationRouter = router({
    listBuckets: publicProcedure.input(conversationListBucketsInputSchema).query(async ({ input }) => {
        return {
            buckets: await conversationStore.listBuckets(input.profileId),
        };
    }),
    listThreads: publicProcedure.input(conversationListThreadsInputSchema).query(async ({ input }) => {
        const persistedSort = await settingsStore.getStringOptional(input.profileId, THREAD_SORT_SETTING_KEY);
        const selectedSort = input.sort ?? (isThreadSort(persistedSort) ? persistedSort : DEFAULT_THREAD_SORT);

        if (input.sort && input.sort !== persistedSort) {
            await settingsStore.setString(input.profileId, THREAD_SORT_SETTING_KEY, input.sort);
        }

        return {
            sort: selectedSort,
            threads: await threadStore.list({
                ...input,
                sort: selectedSort,
            }),
        };
    }),
    createThread: publicProcedure.input(conversationCreateThreadInputSchema).mutation(async ({ input }) => {
        const bucket = await conversationStore.createOrGetBucket({
            profileId: input.profileId,
            scope: input.scope,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });
        const thread = await threadStore.create({
            profileId: input.profileId,
            conversationId: bucket.id,
            title: input.title,
        });

        await runtimeEventLogService.append({
            entityType: 'thread',
            entityId: thread.id,
            eventType: 'conversation.thread.created',
            payload: {
                profileId: input.profileId,
                bucket,
                thread,
            },
        });

        return {
            bucket,
            thread,
        };
    }),
    renameThread: publicProcedure.input(conversationRenameThreadInputSchema).mutation(async ({ input }) => {
        const thread = await threadStore.rename(input.profileId, input.threadId, input.title);
        if (!thread) {
            return {
                renamed: false as const,
                reason: 'not_found' as const,
            };
        }

        await runtimeEventLogService.append({
            entityType: 'thread',
            entityId: thread.id,
            eventType: 'conversation.thread.renamed',
            payload: {
                profileId: input.profileId,
                thread,
            },
        });

        return {
            renamed: true as const,
            thread,
        };
    }),
    listTags: publicProcedure.input(conversationListTagsInputSchema).query(async ({ input }) => {
        return {
            tags: await tagStore.listByProfile(input.profileId),
        };
    }),
    upsertTag: publicProcedure.input(conversationUpsertTagInputSchema).mutation(async ({ input }) => {
        const tag = await tagStore.upsert(input.profileId, input.label);
        return { tag };
    }),
    setThreadTags: publicProcedure.input(conversationSetThreadTagsInputSchema).mutation(async ({ input }) => {
        const threadTags = await tagStore.setThreadTags(input.profileId, input.threadId, input.tagIds);
        await runtimeEventLogService.append({
            entityType: 'thread',
            entityId: input.threadId,
            eventType: 'conversation.thread.tags.updated',
            payload: {
                profileId: input.profileId,
                threadId: input.threadId,
                tagIds: threadTags.map((item) => item.tagId),
            },
        });

        return {
            threadTags,
        };
    }),
});
