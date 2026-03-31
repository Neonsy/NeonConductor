import { describe, expect, it, vi } from 'vitest';

const { deleteBySessionIdsMock } = vi.hoisted(() => ({
    deleteBySessionIdsMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    toolResultArtifactStore: {
        deleteBySessionIds: deleteBySessionIdsMock,
    },
}));

import { planWorkspaceReset } from '@/app/backend/runtime/services/runtimeReset/workspace';

function createSelectQuery(rows: Record<string, unknown>[] = [], count = 0) {
    const query = {
        select: () => query,
        selectAll: () => query,
        leftJoin: () => query,
        innerJoin: () => query,
        distinct: () => query,
        where: () => query,
        orderBy: () => query,
        groupBy: () => query,
        execute: async () => rows,
        executeTakeFirst: async () => ({ count }),
    };
    return query;
}

function createDeleteQuery(deletedTables: string[], table: string) {
    const query = {
        where: () => query,
        execute: async () => {
            deletedTables.push(table);
        },
    };
    return query;
}

function createWorkspaceResetDb() {
    const deletedTables: string[] = [];

    return {
        db: {
            selectFrom: (table: string) => {
                if (table === 'conversations') {
                    return createSelectQuery([{ id: 'conv_test' }]);
                }
                if (table === 'sessions') {
                    return createSelectQuery([{ id: 'sess_test' }]);
                }
                if (table === 'threads') {
                    return createSelectQuery([{ id: 'thr_test' }]);
                }
                if (table === 'runs') {
                    return createSelectQuery([{ id: 'run_test' }]);
                }
                if (table === 'diffs') {
                    return createSelectQuery([]);
                }
                if (table === 'checkpoints') {
                    return createSelectQuery([]);
                }
                if (table === 'thread_tags') {
                    return createSelectQuery([]);
                }
                if (table === 'tags') {
                    return createSelectQuery([]);
                }
                if (table === 'rulesets' || table === 'skillfiles' || table === 'runtime_events') {
                    return createSelectQuery([], 0);
                }
                if (table === 'messages' || table === 'message_parts' || table === 'run_usage') {
                    return createSelectQuery([], 0);
                }

                return createSelectQuery([]);
            },
            deleteFrom: (table: string) => createDeleteQuery(deletedTables, table),
        },
        deletedTables,
    };
}

describe('runtimeReset/workspace', () => {
    it('cleans up tool-result artifacts for workspace session ids before deleting sessions', async () => {
        deleteBySessionIdsMock.mockReset();
        const { db, deletedTables } = createWorkspaceResetDb();
        const plan = await planWorkspaceReset(db as never, 'workspace', 'ws_test');

        await plan.apply(db as never);

        expect(deleteBySessionIdsMock).toHaveBeenCalledWith(['sess_test']);
        expect(deletedTables).toContain('sessions');
    });
});
