import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    closePersistence,
    getPersistence,
    initializePersistence,
} from '@/app/backend/persistence/db';
import { appRouter } from '@/app/backend/trpc/router';

import type { Context } from '@/app/backend/trpc/context';

function createCaller() {
    const context: Context = {
        senderId: 1,
        win: null,
    };

    return appRouter.createCaller(context);
}

const tempDirs: string[] = [];

afterEach(() => {
    closePersistence();
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe('persistence bootstrap and durability', () => {
    it('applies migrations and remains idempotent across reinitialization', async () => {
        const tempDir = mkdtempSync(path.join(os.tmpdir(), 'neonconductor-persistence-'));
        tempDirs.push(tempDir);
        const dbPath = path.join(tempDir, 'runtime.sqlite');

        initializePersistence({
            dbPath,
            resetDb: true,
            forceReinitialize: true,
        });

        const firstCountRow = getPersistence().sqlite
            .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
            .get() as { count: number };

        closePersistence();

        initializePersistence({
            dbPath,
            forceReinitialize: true,
        });

        const secondCountRow = getPersistence().sqlite
            .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
            .get() as { count: number };

        expect(firstCountRow.count).toBeGreaterThan(0);
        expect(secondCountRow.count).toBe(firstCountRow.count);

        const caller = createCaller();
        const providers = await caller.provider.listProviders();
        expect(providers.providers.length).toBeGreaterThan(0);
    });

    it('persists runtime data across process-style reinitialization', async () => {
        const tempDir = mkdtempSync(path.join(os.tmpdir(), 'neonconductor-persistence-'));
        tempDirs.push(tempDir);
        const dbPath = path.join(tempDir, 'runtime.sqlite');

        initializePersistence({
            dbPath,
            resetDb: true,
            forceReinitialize: true,
        });

        const caller = createCaller();
        const created = await caller.session.create({
            scope: 'detached',
            kind: 'local',
        });

        closePersistence();

        initializePersistence({
            dbPath,
            forceReinitialize: true,
        });

        const nextCaller = createCaller();
        const listed = await nextCaller.session.list();

        expect(listed.sessions.some((item) => item.id === created.session.id)).toBe(true);
    });
});

