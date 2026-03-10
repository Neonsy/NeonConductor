import path from 'node:path';

import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { WorktreeRecord } from '@/app/backend/persistence/types';
import { worktreeStatuses } from '@/app/backend/runtime/contracts';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

function toPathKey(absolutePath: string): string {
    return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
}

function canonicalizeAbsolutePath(value: string): string {
    return path.resolve(value.trim());
}

function mapWorktreeRecord(row: {
    id: string;
    profile_id: string;
    workspace_fingerprint: string;
    branch: string;
    base_branch: string;
    absolute_path: string;
    label: string;
    status: string;
    created_at: string;
    updated_at: string;
    last_used_at: string;
}): WorktreeRecord {
    return {
        id: parseEntityId(row.id, 'worktrees.id', 'wt'),
        profileId: row.profile_id,
        workspaceFingerprint: row.workspace_fingerprint,
        branch: row.branch,
        baseBranch: row.base_branch,
        absolutePath: row.absolute_path,
        label: row.label,
        status: parseEnumValue(row.status, 'worktrees.status', worktreeStatuses),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
    };
}

export class WorktreeStore {
    async listByProfile(profileId: string): Promise<WorktreeRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('worktrees')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('status', '!=', 'removed')
            .orderBy('updated_at', 'desc')
            .orderBy('branch', 'asc')
            .execute();

        return rows.map(mapWorktreeRecord);
    }

    async listByWorkspace(profileId: string, workspaceFingerprint: string): Promise<WorktreeRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('worktrees')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('workspace_fingerprint', '=', workspaceFingerprint)
            .where('status', '!=', 'removed')
            .orderBy('updated_at', 'desc')
            .orderBy('branch', 'asc')
            .execute();

        return rows.map(mapWorktreeRecord);
    }

    async getById(profileId: string, worktreeId: string): Promise<WorktreeRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('worktrees')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('id', '=', worktreeId)
            .executeTakeFirst();

        return row ? mapWorktreeRecord(row) : null;
    }

    async getByBranch(profileId: string, workspaceFingerprint: string, branch: string): Promise<WorktreeRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('worktrees')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('workspace_fingerprint', '=', workspaceFingerprint)
            .where('branch', '=', branch)
            .where('status', '!=', 'removed')
            .executeTakeFirst();

        return row ? mapWorktreeRecord(row) : null;
    }

    async create(input: {
        profileId: string;
        workspaceFingerprint: string;
        branch: string;
        baseBranch: string;
        absolutePath: string;
        label: string;
        status: WorktreeRecord['status'];
    }): Promise<WorktreeRecord> {
        const { db } = getPersistence();
        const now = nowIso();
        const absolutePath = canonicalizeAbsolutePath(input.absolutePath);
        const inserted = await db
            .insertInto('worktrees')
            .values({
                id: createEntityId('wt'),
                profile_id: input.profileId,
                workspace_fingerprint: input.workspaceFingerprint,
                branch: input.branch,
                base_branch: input.baseBranch,
                absolute_path: absolutePath,
                path_key: toPathKey(absolutePath),
                label: input.label,
                status: input.status,
                created_at: now,
                updated_at: now,
                last_used_at: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return mapWorktreeRecord(inserted);
    }

    async update(input: {
        profileId: string;
        worktreeId: string;
        absolutePath?: string;
        label?: string;
        status?: WorktreeRecord['status'];
        branch?: string;
        baseBranch?: string;
        touchLastUsed?: boolean;
    }): Promise<WorktreeRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();
        const absolutePath = input.absolutePath ? canonicalizeAbsolutePath(input.absolutePath) : undefined;
        const updated = await db
            .updateTable('worktrees')
            .set({
                ...(absolutePath ? { absolute_path: absolutePath, path_key: toPathKey(absolutePath) } : {}),
                ...(input.label ? { label: input.label } : {}),
                ...(input.status ? { status: input.status } : {}),
                ...(input.branch ? { branch: input.branch } : {}),
                ...(input.baseBranch ? { base_branch: input.baseBranch } : {}),
                ...(input.touchLastUsed ? { last_used_at: now } : {}),
                updated_at: now,
            })
            .where('profile_id', '=', input.profileId)
            .where('id', '=', input.worktreeId)
            .returningAll()
            .executeTakeFirst();

        return updated ? mapWorktreeRecord(updated) : null;
    }

    async delete(profileId: string, worktreeId: string): Promise<boolean> {
        const { db } = getPersistence();
        const deleted = await db
            .deleteFrom('worktrees')
            .where('profile_id', '=', profileId)
            .where('id', '=', worktreeId)
            .returning('id')
            .executeTakeFirst();

        return Boolean(deleted);
    }

    async listOrphaned(profileId: string): Promise<WorktreeRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('worktrees')
            .leftJoin('threads', (join) =>
                join.onRef('threads.worktree_id', '=', 'worktrees.id').onRef('threads.profile_id', '=', 'worktrees.profile_id')
            )
            .leftJoin('sessions', (join) =>
                join.onRef('sessions.worktree_id', '=', 'worktrees.id').onRef('sessions.profile_id', '=', 'worktrees.profile_id')
            )
            .select([
                'worktrees.id',
                'worktrees.profile_id',
                'worktrees.workspace_fingerprint',
                'worktrees.branch',
                'worktrees.base_branch',
                'worktrees.absolute_path',
                'worktrees.label',
                'worktrees.status',
                'worktrees.created_at',
                'worktrees.updated_at',
                'worktrees.last_used_at',
            ])
            .where('worktrees.profile_id', '=', profileId)
            .where('worktrees.status', '!=', 'removed')
            .groupBy([
                'worktrees.id',
                'worktrees.profile_id',
                'worktrees.workspace_fingerprint',
                'worktrees.branch',
                'worktrees.base_branch',
                'worktrees.absolute_path',
                'worktrees.label',
                'worktrees.status',
                'worktrees.created_at',
                'worktrees.updated_at',
                'worktrees.last_used_at',
            ])
            .having((eb) => eb.fn.count('threads.id'), '=', 0)
            .having((eb) => eb.fn.count('sessions.id'), '=', 0)
            .execute();

        return rows.map(mapWorktreeRecord);
    }

    async hasRunningSession(profileId: string, worktreeId: string): Promise<boolean> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('sessions')
            .select('id')
            .where('profile_id', '=', profileId)
            .where('worktree_id', '=', worktreeId)
            .where('run_status', '=', 'running')
            .executeTakeFirst();

        return Boolean(row);
    }
}

export const worktreeStore = new WorktreeStore();

