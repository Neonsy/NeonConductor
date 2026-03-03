import { randomUUID } from 'node:crypto';

import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { ThreadListRecord, ThreadRecord } from '@/app/backend/persistence/types';

type ThreadSort = 'latest' | 'alphabetical';

interface ThreadRow {
    id: string;
    profile_id: string;
    conversation_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface ThreadListQueryRow extends ThreadRow {
    scope: string;
    workspace_fingerprint: string | null;
    session_count: number;
    latest_session_updated_at: string | null;
}

function createThreadId(): string {
    return `thr_${randomUUID()}`;
}

function mapThreadRecord(row: ThreadRow): ThreadRecord {
    return {
        id: row.id,
        profileId: row.profile_id,
        conversationId: row.conversation_id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function compareIsoDesc(left?: string, right?: string): number {
    const leftValue = left ?? '';
    const rightValue = right ?? '';
    if (leftValue > rightValue) return -1;
    if (leftValue < rightValue) return 1;
    return 0;
}

function compareScopePriority(left: ThreadListRecord, right: ThreadListRecord): number {
    if (left.scope === right.scope) {
        return 0;
    }

    return left.scope === 'workspace' ? -1 : 1;
}

export class ThreadStore {
    async create(input: { profileId: string; conversationId: string; title: string }): Promise<ThreadRecord> {
        const title = input.title.trim();
        if (title.length === 0) {
            throw new Error('Thread title must be a non-empty string.');
        }

        const { db } = getPersistence();
        const conversation = await db
            .selectFrom('conversations')
            .select(['id'])
            .where('id', '=', input.conversationId)
            .where('profile_id', '=', input.profileId)
            .executeTakeFirst();

        if (!conversation) {
            throw new Error(`Conversation "${input.conversationId}" does not exist for profile "${input.profileId}".`);
        }

        const now = nowIso();
        const inserted = await db
            .insertInto('threads')
            .values({
                id: createThreadId(),
                profile_id: input.profileId,
                conversation_id: input.conversationId,
                title,
                created_at: now,
                updated_at: now,
            })
            .returning(['id', 'profile_id', 'conversation_id', 'title', 'created_at', 'updated_at'])
            .executeTakeFirstOrThrow();

        return mapThreadRecord(inserted);
    }

    async rename(profileId: string, threadId: string, title: string): Promise<ThreadRecord | null> {
        const trimmed = title.trim();
        if (trimmed.length === 0) {
            throw new Error('Thread title must be a non-empty string.');
        }

        const { db } = getPersistence();
        const updated = await db
            .updateTable('threads')
            .set({
                title: trimmed,
                updated_at: nowIso(),
            })
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .returning(['id', 'profile_id', 'conversation_id', 'title', 'created_at', 'updated_at'])
            .executeTakeFirst();

        return updated ? mapThreadRecord(updated) : null;
    }

    async getById(profileId: string, threadId: string): Promise<ThreadRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('threads')
            .select(['id', 'profile_id', 'conversation_id', 'title', 'created_at', 'updated_at'])
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .executeTakeFirst();

        return row ? mapThreadRecord(row) : null;
    }

    async list(input: {
        profileId: string;
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
                'threads.created_at',
                'threads.updated_at',
                'conversations.scope',
                'conversations.workspace_fingerprint',
            ]);

        if (input.scope) {
            query = query.where('conversations.scope', '=', input.scope);
        }

        if (input.workspaceFingerprint) {
            query = query.where('conversations.workspace_fingerprint', '=', input.workspaceFingerprint);
        }

        const rows = (await query.execute()) as ThreadListQueryRow[];
        const listed = rows.map<ThreadListRecord>((row) => ({
            id: row.id,
            profileId: row.profile_id,
            conversationId: row.conversation_id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            scope: row.scope === 'workspace' ? 'workspace' : 'detached',
            ...(row.workspace_fingerprint ? { workspaceFingerprint: row.workspace_fingerprint } : {}),
            sessionCount: row.session_count,
            ...(row.latest_session_updated_at ? { latestSessionUpdatedAt: row.latest_session_updated_at } : {}),
        }));

        const applyWorkspacePriority = !input.scope;

        listed.sort((left, right) => {
            if (applyWorkspacePriority) {
                const scopeCompare = compareScopePriority(left, right);
                if (scopeCompare !== 0) {
                    return scopeCompare;
                }
            }

            if (input.sort === 'alphabetical') {
                const titleCompare = left.title.localeCompare(right.title, undefined, {
                    sensitivity: 'base',
                    numeric: true,
                });
                if (titleCompare !== 0) {
                    return titleCompare;
                }
            } else {
                const leftActivity = left.latestSessionUpdatedAt ?? left.updatedAt;
                const rightActivity = right.latestSessionUpdatedAt ?? right.updatedAt;
                const activityCompare = compareIsoDesc(leftActivity, rightActivity);
                if (activityCompare !== 0) {
                    return activityCompare;
                }
            }

            return left.id.localeCompare(right.id);
        });

        return listed;
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
}

export const threadStore = new ThreadStore();
