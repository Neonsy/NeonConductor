import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { seedRuntimeData } from '@/app/backend/persistence/bootstrap/runtimeSeed';
import { runtimeSqlMigrations } from '@/app/backend/persistence/generatedMigrations';
import {
    markPersistenceBaselineApplied,
    resetPersistenceBaseline,
    shouldResetPersistenceBaseline,
} from '@/app/backend/persistence/runtimeBaseline';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import { InvariantError } from '@/app/backend/runtime/services/common/fatalErrors';
import { appLog } from '@/app/main/logging';

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

export interface PersistenceContext {
    sqlite: BetterSqliteDatabase;
    db: Kysely<DatabaseSchema>;
    dbPath: string;
}

export interface InitializePersistenceOptions {
    dataDir?: string;
    dbPath?: string;
    resetDb?: boolean;
    forceReinitialize?: boolean;
}

const DEFAULT_DB_FILENAME = 'neonconductor.db';
const TEST_MEMORY_PATH = ':memory:';
const DEFAULT_PROFILE_ID = 'profile_local_default';
const DB_FILE_EXTENSIONS = new Set(['.db', '.sqlite']);

let persistenceContext: PersistenceContext | null = null;

function failInvariant(message: string, details?: Record<string, unknown>): never {
    appLog.error({
        tag: 'persistence.db',
        message,
        ...(details ?? {}),
    });
    throw new InvariantError(message);
}

function isMemoryDbPath(dbPath: string): boolean {
    return dbPath === TEST_MEMORY_PATH;
}

function resolveDefaultDbPath(): string {
    const envDbPath = process.env['NEONCONDUCTOR_DB_PATH'];
    if (typeof envDbPath === 'string' && envDbPath.trim().length > 0) {
        return envDbPath.trim();
    }

    const fallbackDir = path.join(os.tmpdir(), 'neonconductor');
    return path.join(fallbackDir, DEFAULT_DB_FILENAME);
}

function resolveSafeFileDbPath(dbPath: string): string {
    const trimmed = dbPath.trim();
    if (trimmed.length === 0) {
        failInvariant('Persistence DB path must be a non-empty string.');
    }

    if (!path.isAbsolute(trimmed)) {
        failInvariant(`Persistence DB path must be absolute. Received: "${trimmed}"`, { dbPath: trimmed });
    }

    const normalized = path.resolve(trimmed);
    const extension = path.extname(normalized).toLowerCase();

    if (!DB_FILE_EXTENSIONS.has(extension)) {
        failInvariant(
            `Persistence DB path must use one of: ${Array.from(DB_FILE_EXTENSIONS).join(', ')}. Received: "${normalized}"`,
            { dbPath: normalized, extension }
        );
    }

    const directory = path.dirname(normalized);
    const parsedDirectory = path.parse(directory);
    if (directory === parsedDirectory.root) {
        failInvariant(`Persistence DB path directory cannot be filesystem root: "${normalized}"`, {
            dbPath: normalized,
            directory,
        });
    }

    return normalized;
}

function resolveDbPath(options: InitializePersistenceOptions): string {
    const explicitDbPath = options.dbPath?.trim();
    if (explicitDbPath) {
        return isMemoryDbPath(explicitDbPath) ? TEST_MEMORY_PATH : resolveSafeFileDbPath(explicitDbPath);
    }

    if (options.dataDir?.trim()) {
        if (!path.isAbsolute(options.dataDir)) {
            failInvariant(`Persistence dataDir must be absolute. Received: "${options.dataDir}"`, {
                dataDir: options.dataDir,
            });
        }

        return resolveSafeFileDbPath(path.join(path.resolve(options.dataDir), DEFAULT_DB_FILENAME));
    }

    return resolveSafeFileDbPath(resolveDefaultDbPath());
}

function ensureParentDirectory(dbPath: string): void {
    if (isMemoryDbPath(dbPath)) {
        return;
    }

    const directory = path.dirname(dbPath);
    mkdirSync(directory, { recursive: true });
}

function applySqlMigrations(sqlite: BetterSqliteDatabase): void {
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
    `);

    const isAppliedStatement = sqlite.prepare('SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1');
    const recordAppliedStatement = sqlite.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');

    for (const migration of runtimeSqlMigrations) {
        const wasApplied = isAppliedStatement.get(migration.name);
        if (wasApplied) {
            continue;
        }

        const appliedAt = new Date().toISOString();

        const runMigration = sqlite.transaction(() => {
            sqlite.exec(migration.sql);
            recordAppliedStatement.run(migration.name, appliedAt);
        });

        runMigration();
    }
}

export function reseedRuntimeData(): void {
    const context = getPersistence();
    seedRuntimeData(context.sqlite, DEFAULT_PROFILE_ID);
}

function createPersistenceContext(dbPath: string): PersistenceContext {
    ensureParentDirectory(dbPath);

    const sqlite = new BetterSqlite3(dbPath);
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');

    applySqlMigrations(sqlite);
    seedRuntimeData(sqlite, DEFAULT_PROFILE_ID);

    const db = new Kysely<DatabaseSchema>({
        dialect: new SqliteDialect({
            database: sqlite,
        }),
    });

    return {
        sqlite,
        db,
        dbPath,
    };
}

export function closePersistence(): void {
    if (!persistenceContext) {
        return;
    }

    void persistenceContext.db.destroy();
    persistenceContext.sqlite.close();
    persistenceContext = null;
}

export function initializePersistence(options: InitializePersistenceOptions = {}): PersistenceContext {
    const dbPath = resolveDbPath(options);
    const resetForBaseline = shouldResetPersistenceBaseline(dbPath);

    if (persistenceContext && (options.forceReinitialize || persistenceContext.dbPath !== dbPath)) {
        closePersistence();
    }

    if (options.resetDb && !isMemoryDbPath(dbPath)) {
        rmSync(dbPath, { force: true });
    }
    if (resetForBaseline) {
        appLog.warn({
            tag: 'persistence.db',
            message: 'Resetting runtime persistence for new baseline schema.',
            dbPath,
        });
        resetPersistenceBaseline(dbPath);
    }

    if (persistenceContext && !options.forceReinitialize && persistenceContext.dbPath === dbPath) {
        return persistenceContext;
    }

    persistenceContext = createPersistenceContext(dbPath);
    markPersistenceBaselineApplied(dbPath);
    return persistenceContext;
}

export function getPersistence(): PersistenceContext {
    if (persistenceContext) {
        return persistenceContext;
    }

    return initializePersistence();
}

export function resetPersistenceForTests(dbPath = TEST_MEMORY_PATH): PersistenceContext {
    closePersistence();
    return initializePersistence({
        dbPath,
        resetDb: !isMemoryDbPath(dbPath),
        forceReinitialize: true,
    });
}

export function getDefaultProfileId(): string {
    return DEFAULT_PROFILE_ID;
}
