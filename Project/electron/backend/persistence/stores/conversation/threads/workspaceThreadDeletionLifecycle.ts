import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';

import type {
    WorkspaceThreadDeletePreview,
    WorkspaceThreadDeletionPlan,
} from '@/app/backend/persistence/stores/conversation/threads/threadLifecycle.types';
import type { EntityId } from '@/app/backend/runtime/contracts';

function uniqueValues<T>(values: readonly T[]): T[] {
    return [...new Set(values)];
}

export async function resolveWorkspaceThreadDeletionPlan(
    profileId: string,
    workspaceFingerprint: string,
    includeFavorites: boolean
): Promise<WorkspaceThreadDeletionPlan> {
    const { db } = getPersistence();
    const workspaceThreads = await db
        .selectFrom('threads')
        .innerJoin('conversations', 'conversations.id', 'threads.conversation_id')
        .select(['threads.id', 'threads.root_thread_id', 'threads.is_favorite', 'threads.conversation_id'])
        .where('threads.profile_id', '=', profileId)
        .where('conversations.scope', '=', 'workspace')
        .where('conversations.workspace_fingerprint', '=', workspaceFingerprint)
        .execute();

    const totalThreadCount = workspaceThreads.length;
    const favoriteThreads = workspaceThreads.filter((thread) => thread.is_favorite === 1);
    const favoriteThreadCount = favoriteThreads.length;
    const protectedThreadIds = includeFavorites
        ? new Set<string>()
        : new Set<string>([
              ...favoriteThreads.map((thread) => thread.id),
              ...favoriteThreads.map((thread) => thread.root_thread_id),
          ]);
    const deletableThreadIds = workspaceThreads
        .filter((thread) => !protectedThreadIds.has(thread.id))
        .map((thread) => parseEntityId(thread.id, 'threads.id', 'thr'));

    if (deletableThreadIds.length === 0) {
        return {
            totalThreadCount,
            favoriteThreadCount,
            deletableThreadIds: [],
            deletedTagIds: [],
            deletedConversationIds: [],
            sessionIds: [],
            runIds: [],
            messageIds: [],
            messagePartIds: [],
            checkpointIds: [],
            diffIds: [],
            runtimeEventEntityIds: [],
        };
    }

    const deletableThreadIdSet = new Set(deletableThreadIds);
    const candidateConversationIds = uniqueValues(
        workspaceThreads
            .filter((thread) => deletableThreadIdSet.has(parseEntityId(thread.id, 'threads.id', 'thr')))
            .map((thread) => thread.conversation_id)
    );
    const retainedConversationRows = await db
        .selectFrom('threads')
        .select(['id', 'conversation_id'])
        .where('profile_id', '=', profileId)
        .where('conversation_id', 'in', candidateConversationIds)
        .execute();
    const deletedConversationIds = candidateConversationIds.filter((conversationId) => {
        return !retainedConversationRows.some(
            (thread) =>
                thread.conversation_id === conversationId &&
                !deletableThreadIdSet.has(parseEntityId(thread.id, 'threads.id', 'thr'))
        );
    });

    const sessionRows = await db
        .selectFrom('sessions')
        .select('id')
        .where('profile_id', '=', profileId)
        .where('thread_id', 'in', deletableThreadIds)
        .execute();
    const sessionIds = sessionRows.map((row) => parseEntityId(row.id, 'sessions.id', 'sess'));

    const runRows = sessionIds.length
        ? await db.selectFrom('runs').select('id').where('session_id', 'in', sessionIds).execute()
        : [];
    const runIds = runRows.map((row) => parseEntityId(row.id, 'runs.id', 'run'));

    const messageRows = sessionIds.length
        ? await db.selectFrom('messages').select('id').where('session_id', 'in', sessionIds).execute()
        : [];
    const messageIds = messageRows.map((row) => parseEntityId(row.id, 'messages.id', 'msg'));

    const messagePartRows = messageIds.length
        ? await db.selectFrom('message_parts').select('id').where('message_id', 'in', messageIds).execute()
        : [];
    const messagePartIds = messagePartRows.map((row) => row.id);

    const checkpointRows = sessionIds.length
        ? await db.selectFrom('checkpoints').select('id').where('session_id', 'in', sessionIds).execute()
        : [];
    const checkpointIds = checkpointRows.map((row) => parseEntityId(row.id, 'checkpoints.id', 'ckpt'));

    const diffRows = sessionIds.length
        ? await db.selectFrom('diffs').select('id').where('session_id', 'in', sessionIds).execute()
        : [];
    const diffIds = diffRows.map((row) => row.id);

    const candidateTagRows = await db
        .selectFrom('thread_tags')
        .select('tag_id')
        .distinct()
        .where('thread_id', 'in', deletableThreadIds)
        .execute();
    const candidateTagIds = candidateTagRows.map((row) => parseEntityId(row.tag_id, 'thread_tags.tag_id', 'tag'));
    const retainedTagIds = candidateTagIds.length
        ? (
              await db
                  .selectFrom('thread_tags')
                  .select('tag_id')
                  .distinct()
                  .where('tag_id', 'in', candidateTagIds)
                  .where((expressionBuilder) =>
                      expressionBuilder.not(expressionBuilder('thread_id', 'in', deletableThreadIds))
                  )
                  .execute()
          ).reduce((value, row) => {
              value.add(parseEntityId(row.tag_id, 'thread_tags.tag_id', 'tag'));
              return value;
          }, new Set<EntityId<'tag'>>())
        : new Set<EntityId<'tag'>>();
    const deletedTagIds = candidateTagIds.filter((tagId) => !retainedTagIds.has(tagId));

    return {
        totalThreadCount,
        favoriteThreadCount,
        deletableThreadIds,
        deletedTagIds,
        deletedConversationIds,
        sessionIds,
        runIds,
        messageIds,
        messagePartIds,
        checkpointIds,
        diffIds,
        runtimeEventEntityIds: uniqueValues([
            ...deletableThreadIds,
            ...deletedConversationIds,
            ...sessionIds,
            ...runIds,
            ...messageIds,
            ...messagePartIds,
            ...checkpointIds,
            ...diffIds,
            ...deletedTagIds,
        ]),
    };
}

export async function getWorkspaceThreadDeletionPreview(input: {
    profileId: string;
    workspaceFingerprint: string;
    includeFavorites: boolean;
}): Promise<WorkspaceThreadDeletePreview> {
    const resolved = await resolveWorkspaceThreadDeletionPlan(
        input.profileId,
        input.workspaceFingerprint,
        input.includeFavorites
    );

    return {
        workspaceFingerprint: input.workspaceFingerprint,
        totalThreadCount: resolved.totalThreadCount,
        favoriteThreadCount: resolved.favoriteThreadCount,
        deletableThreadCount: resolved.deletableThreadIds.length,
    };
}

export async function applyWorkspaceThreadDeletion(input: {
    profileId: string;
    workspaceFingerprint: string;
    includeFavorites: boolean;
}): Promise<WorkspaceThreadDeletionPlan> {
    const resolved = await resolveWorkspaceThreadDeletionPlan(
        input.profileId,
        input.workspaceFingerprint,
        input.includeFavorites
    );
    if (resolved.deletableThreadIds.length === 0) {
        return resolved;
    }

    const { db } = getPersistence();
    await db.transaction().execute(async (transaction) => {
        if (resolved.runtimeEventEntityIds.length > 0) {
            await transaction.deleteFrom('runtime_events').where('entity_id', 'in', resolved.runtimeEventEntityIds).execute();
        }

        await transaction
            .deleteFrom('threads')
            .where('profile_id', '=', input.profileId)
            .where('id', 'in', resolved.deletableThreadIds)
            .execute();

        if (resolved.deletedConversationIds.length > 0) {
            await transaction
                .deleteFrom('conversations')
                .where('profile_id', '=', input.profileId)
                .where('id', 'in', resolved.deletedConversationIds)
                .execute();
        }

        if (resolved.deletedTagIds.length > 0) {
            await transaction
                .deleteFrom('tags')
                .where('profile_id', '=', input.profileId)
                .where('id', 'in', resolved.deletedTagIds)
                .execute();
        }
    });

    return resolved;
}
