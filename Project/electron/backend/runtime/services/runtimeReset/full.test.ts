import { describe, expect, it, vi } from 'vitest';

const { deleteAllMock } = vi.hoisted(() => ({
    deleteAllMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    toolResultArtifactStore: {
        deleteAll: deleteAllMock,
    },
}));

import { planFullReset } from '@/app/backend/runtime/services/runtimeReset/full';

function createResetDb(input?: {
    counts?: Record<string, number>;
    deletedTables?: string[];
}) {
    const counts = input?.counts ?? {};
    const deletedTables = input?.deletedTables ?? [];

    const createSelectQuery = (table: string) => {
        const query = {
            select: () => query,
            executeTakeFirst: async () => ({
                count: counts[table] ?? 0,
            }),
        };
        return query;
    };

    const createDeleteQuery = (table: string) => {
        const query = {
            execute: async () => {
                deletedTables.push(table);
            },
        };
        return query;
    };

    return {
        db: {
            selectFrom: (table: string) => createSelectQuery(table),
            deleteFrom: (table: string) => createDeleteQuery(table),
        },
        deletedTables,
    };
}

describe('runtimeReset/full', () => {
    it('cleans up tool-result artifacts during full reset apply', async () => {
        deleteAllMock.mockReset();
        const { db } = createResetDb();
        const plan = await planFullReset(db as never);

        await plan.apply(db as never);

        expect(deleteAllMock).toHaveBeenCalledTimes(1);
    });

    it('includes preparation rows in full reset counts', async () => {
        const { db } = createResetDb({
            counts: {
                session_context_compaction_preparations: 4,
            },
        });

        const plan = await planFullReset(db as never);

        expect(plan.counts.sessionContextCompactionPreparations).toBe(4);
    });

    it('deletes preparation rows during full reset apply', async () => {
        const { db, deletedTables } = createResetDb();
        const plan = await planFullReset(db as never);

        await plan.apply(db as never);

        expect(deletedTables).toContain('session_context_compaction_preparations');
    });
});
