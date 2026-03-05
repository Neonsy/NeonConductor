import { randomUUID } from 'node:crypto';

import { getPersistence } from '@/app/backend/persistence/db';
import { parseEnumValue } from '@/app/backend/persistence/stores/rowParsers';
import { mapThreadListRecord, mapThreadRecord } from '@/app/backend/persistence/stores/threadStore.mapper';
import {
    compareAnchor,
    compareIsoDesc,
    compareThreadOrder,
    flattenBranchView,
    getAnchorActivity,
    toAnchorKey,
    type ThreadSort,
} from '@/app/backend/persistence/stores/threadStore.ordering';
import {
    SESSION_THREAD_WITH_CONVERSATION_COLUMNS,
    THREAD_COLUMNS,
} from '@/app/backend/persistence/stores/threadStore.queries';
import { parseThreadTitle } from '@/app/backend/persistence/stores/threadStore.validation';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { ThreadListRecord, ThreadRecord } from '@/app/backend/persistence/types';
import { topLevelTabs } from '@/app/backend/runtime/contracts';
import type { TopLevelTab } from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';

type ThreadGroupView = 'workspace' | 'branch';

function createThreadId(): string {
    return `thr_${randomUUID()}`;
}

export class ThreadStore {
    async create(input: {
        profileId: string;
        conversationId: string;
        title: string;
        topLevelTab: TopLevelTab;
        parentThreadId?: string;
        rootThreadId?: string;
    }): Promise<OperationalResult<ThreadRecord>> {
        const title = parseThreadTitle(input.title);
        if (title.isErr()) {
            return errOp(title.error.code, title.error.message, {
                ...(title.error.details ? { details: title.error.details } : {}),
                ...(title.error.retryable !== undefined ? { retryable: title.error.retryable } : {}),
            });
        }

        const { db } = getPersistence();
        const conversation = await db
            .selectFrom('conversations')
            .select(['id', 'scope'])
            .where('id', '=', input.conversationId)
            .where('profile_id', '=', input.profileId)
            .executeTakeFirst();

        if (!conversation) {
            return errOp(
                'conversation_not_found',
                `Conversation "${input.conversationId}" does not exist for profile "${input.profileId}".`
            );
        }

        if (conversation.scope === 'detached' && input.topLevelTab !== 'chat') {
            return errOp('unsupported_tab', 'Playground threads are chat-only.');
        }

        let resolvedParentThreadId: string | undefined;
        let resolvedRootThreadId: string | undefined;

        if (input.parentThreadId) {
            const parent = await db
                .selectFrom('threads')
                .select(['id', 'conversation_id', 'root_thread_id', 'top_level_tab'])
                .where('id', '=', input.parentThreadId)
                .where('profile_id', '=', input.profileId)
                .executeTakeFirst();
            if (!parent) {
                return errOp(
                    'thread_not_found',
                    `Parent thread "${input.parentThreadId}" does not exist for profile "${input.profileId}".`
                );
            }
            if (parent.conversation_id !== input.conversationId) {
                return errOp('thread_mode_mismatch', 'Parent thread must belong to the same conversation bucket.');
            }
            if (parseEnumValue(parent.top_level_tab, 'threads.top_level_tab', topLevelTabs) !== input.topLevelTab) {
                return errOp('thread_mode_mismatch', 'Thread mode affinity mismatch with parent thread.');
            }

            resolvedParentThreadId = parent.id;
            resolvedRootThreadId = parent.root_thread_id;
        }

        if (input.rootThreadId) {
            const root = await db
                .selectFrom('threads')
                .select(['id', 'conversation_id', 'top_level_tab'])
                .where('id', '=', input.rootThreadId)
                .where('profile_id', '=', input.profileId)
                .executeTakeFirst();
            if (!root) {
                return errOp(
                    'thread_not_found',
                    `Root thread "${input.rootThreadId}" does not exist for profile "${input.profileId}".`
                );
            }
            if (root.conversation_id !== input.conversationId) {
                return errOp('thread_mode_mismatch', 'Root thread must belong to the same conversation bucket.');
            }
            if (parseEnumValue(root.top_level_tab, 'threads.top_level_tab', topLevelTabs) !== input.topLevelTab) {
                return errOp('thread_mode_mismatch', 'Thread mode affinity mismatch with root thread.');
            }
            resolvedRootThreadId = root.id;
        }

        const threadId = createThreadId();
        const now = nowIso();
        const inserted = await db
            .insertInto('threads')
            .values({
                id: threadId,
                profile_id: input.profileId,
                conversation_id: input.conversationId,
                title: title.value,
                top_level_tab: input.topLevelTab,
                parent_thread_id: resolvedParentThreadId ?? null,
                root_thread_id: resolvedRootThreadId ?? threadId,
                last_assistant_at: null,
                created_at: now,
                updated_at: now,
            })
            .returning(THREAD_COLUMNS)
            .executeTakeFirstOrThrow();

        return okOp(mapThreadRecord(inserted));
    }

    async rename(profileId: string, threadId: string, title: string): Promise<OperationalResult<ThreadRecord | null>> {
        const trimmed = parseThreadTitle(title);
        if (trimmed.isErr()) {
            return errOp(trimmed.error.code, trimmed.error.message, {
                ...(trimmed.error.details ? { details: trimmed.error.details } : {}),
                ...(trimmed.error.retryable !== undefined ? { retryable: trimmed.error.retryable } : {}),
            });
        }

        const { db } = getPersistence();
        const updated = await db
            .updateTable('threads')
            .set({
                title: trimmed.value,
                updated_at: nowIso(),
            })
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .returning(THREAD_COLUMNS)
            .executeTakeFirst();

        return okOp(updated ? mapThreadRecord(updated) : null);
    }

    async getById(profileId: string, threadId: string): Promise<ThreadRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('threads')
            .select(THREAD_COLUMNS)
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .executeTakeFirst();

        return row ? mapThreadRecord(row) : null;
    }

    async getBySessionId(
        profileId: string,
        sessionId: string
    ): Promise<null | {
        thread: ThreadRecord;
        scope: 'detached' | 'workspace';
        workspaceFingerprint?: string;
    }> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('sessions')
            .innerJoin('threads', 'threads.id', 'sessions.thread_id')
            .innerJoin('conversations', 'conversations.id', 'threads.conversation_id')
            .select(SESSION_THREAD_WITH_CONVERSATION_COLUMNS)
            .where('sessions.id', '=', sessionId)
            .where('sessions.profile_id', '=', profileId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            thread: mapThreadRecord(row),
            scope: row.scope === 'workspace' ? 'workspace' : 'detached',
            ...(row.workspace_fingerprint ? { workspaceFingerprint: row.workspace_fingerprint } : {}),
        };
    }

    async list(input: {
        profileId: string;
        activeTab: TopLevelTab;
        showAllModes: boolean;
        groupView: ThreadGroupView;
        scope?: 'detached' | 'workspace';
        workspaceFingerprint?: string;
        sort: ThreadSort;
    }): Promise<ThreadListRecord[]> {
        const { db } = getPersistence();
        let query = db
            .selectFrom('threads')
            .innerJoin('conversations', 'conversations.id', 'threads.conversation_id')
            .leftJoin('sessions', (join) =>
                join
                    .onRef('sessions.thread_id', '=', 'threads.id')
                    .onRef('sessions.profile_id', '=', 'threads.profile_id')
            )
            .select((eb) => [
                'threads.id as id',
                'threads.profile_id as profile_id',
                'threads.conversation_id as conversation_id',
                'threads.title as title',
                'threads.top_level_tab as top_level_tab',
                'threads.parent_thread_id as parent_thread_id',
                'threads.root_thread_id as root_thread_id',
                'threads.last_assistant_at as last_assistant_at',
                'threads.created_at as created_at',
                'threads.updated_at as updated_at',
                'conversations.scope as scope',
                'conversations.workspace_fingerprint as workspace_fingerprint',
                eb.fn.count<number>('sessions.id').as('session_count'),
                eb.fn.max<string>('sessions.updated_at').as('latest_session_updated_at'),
            ])
            .where('threads.profile_id', '=', input.profileId)
            .groupBy([
                'threads.id',
                'threads.profile_id',
                'threads.conversation_id',
                'threads.title',
                'threads.top_level_tab',
                'threads.parent_thread_id',
                'threads.root_thread_id',
                'threads.last_assistant_at',
                'threads.created_at',
                'threads.updated_at',
                'conversations.scope',
                'conversations.workspace_fingerprint',
            ]);

        if (!input.showAllModes) {
            query = query.where('threads.top_level_tab', '=', input.activeTab);
        }
        if (input.scope) {
            query = query.where('conversations.scope', '=', input.scope);
        }
        if (input.workspaceFingerprint) {
            query = query.where('conversations.workspace_fingerprint', '=', input.workspaceFingerprint);
        }

        const listed = (await query.execute()).map(mapThreadListRecord);
        const byAnchor = new Map<string, ThreadListRecord[]>();
        for (const thread of listed) {
            const key = toAnchorKey(thread);
            const existing = byAnchor.get(key) ?? [];
            existing.push(thread);
            byAnchor.set(key, existing);
        }

        const orderedAnchors = Array.from(byAnchor.values()).sort((leftGroup, rightGroup) => {
            const leftFirst = leftGroup[0];
            const rightFirst = rightGroup[0];
            if (!leftFirst || !rightFirst) {
                return leftGroup.length - rightGroup.length;
            }
            const activityCompare = compareIsoDesc(getAnchorActivity(leftGroup), getAnchorActivity(rightGroup));
            if (activityCompare !== 0) {
                return activityCompare;
            }
            return compareAnchor(leftFirst, rightFirst);
        });
        for (const anchorThreads of orderedAnchors) {
            anchorThreads.sort((left, right) => compareThreadOrder(left, right, input.sort));
        }
        const groupedOrdered = orderedAnchors.flatMap((group) => group);

        if (input.groupView === 'branch') {
            return flattenBranchView(groupedOrdered, input.sort);
        }

        return groupedOrdered;
    }

    async touchByThread(profileId: string, threadId: string): Promise<void> {
        const { db } = getPersistence();
        const now = nowIso();

        const thread = await db
            .updateTable('threads')
            .set({ updated_at: now })
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .returning(['conversation_id'])
            .executeTakeFirst();

        if (!thread) {
            return;
        }

        await db
            .updateTable('conversations')
            .set({ updated_at: now })
            .where('id', '=', thread.conversation_id)
            .where('profile_id', '=', profileId)
            .execute();
    }

    async markAssistantActivity(profileId: string, threadId: string, atIso: string): Promise<void> {
        const { db } = getPersistence();
        const existing = await db
            .selectFrom('threads')
            .select(['last_assistant_at', 'conversation_id'])
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .executeTakeFirst();
        if (!existing) {
            return;
        }

        const nextLastAssistantAt =
            existing.last_assistant_at && existing.last_assistant_at > atIso ? existing.last_assistant_at : atIso;
        await db
            .updateTable('threads')
            .set({
                last_assistant_at: nextLastAssistantAt,
                updated_at: nowIso(),
            })
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .execute();
        await db
            .updateTable('conversations')
            .set({ updated_at: nowIso() })
            .where('id', '=', existing.conversation_id)
            .where('profile_id', '=', profileId)
            .execute();
    }
}

export const threadStore = new ThreadStore();
