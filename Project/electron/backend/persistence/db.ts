import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';

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

const MIGRATIONS_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const DEFAULT_DB_FILENAME = 'neonconductor.db';
const TEST_MEMORY_PATH = ':memory:';

const GLOBAL_PROFILE_ID = '__global__';

const PROVIDER_SEED = [
    { id: 'kilo', label: 'Kilo', supportsByok: 0 },
    { id: 'openai', label: 'OpenAI', supportsByok: 1 },
] as const;

const MODEL_SEED = [
    { id: 'kilo/auto', providerId: 'kilo', label: 'Kilo Auto' },
    { id: 'kilo/code', providerId: 'kilo', label: 'Kilo Code' },
    { id: 'openai/gpt-5', providerId: 'openai', label: 'GPT-5' },
    { id: 'openai/gpt-5-mini', providerId: 'openai', label: 'GPT-5 Mini' },
] as const;

const TOOL_SEED = [
    {
        id: 'read_file',
        label: 'Read File',
        description: 'Read file contents from the active workspace.',
        permissionPolicy: 'ask',
    },
    {
        id: 'list_files',
        label: 'List Files',
        description: 'List files and folders in the active workspace.',
        permissionPolicy: 'ask',
    },
    {
        id: 'run_command',
        label: 'Run Command',
        description: 'Run a command in a sandboxed shell.',
        permissionPolicy: 'deny',
    },
] as const;

const MCP_SERVER_SEED = [
    {
        id: 'filesystem',
        label: 'Filesystem MCP',
        authMode: 'none',
        connectionState: 'disconnected',
        authState: 'authenticated',
    },
    {
        id: 'github',
        label: 'GitHub MCP',
        authMode: 'token',
        connectionState: 'disconnected',
        authState: 'unauthenticated',
    },
] as const;

const DEFAULT_PROVIDER_ID = 'kilo';
const DEFAULT_MODEL_ID = 'kilo/auto';

let persistenceContext: PersistenceContext | null = null;

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

function resolveDbPath(options: InitializePersistenceOptions): string {
    if (options.dbPath) {
        return options.dbPath;
    }

    if (options.dataDir) {
        return path.join(options.dataDir, DEFAULT_DB_FILENAME);
    }

    return resolveDefaultDbPath();
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

    if (!existsSync(MIGRATIONS_DIRECTORY)) {
        throw new Error(`Missing migrations directory at ${MIGRATIONS_DIRECTORY}`);
    }

    const migrationFiles = readdirSync(MIGRATIONS_DIRECTORY)
        .filter((file) => file.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

    const isAppliedStatement = sqlite.prepare('SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1');
    const recordAppliedStatement = sqlite.prepare(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)'
    );

    for (const filename of migrationFiles) {
        const wasApplied = isAppliedStatement.get(filename);
        if (wasApplied) {
            continue;
        }

        const migrationPath = path.join(MIGRATIONS_DIRECTORY, filename);
        const sql = readFileSync(migrationPath, 'utf8');
        const appliedAt = new Date().toISOString();

        const runMigration = sqlite.transaction(() => {
            sqlite.exec(sql);
            recordAppliedStatement.run(filename, appliedAt);
        });

        runMigration();
    }
}

function seedRuntimeData(sqlite: BetterSqliteDatabase): void {
    const now = new Date().toISOString();

    const insertProvider = sqlite.prepare(
        `
            INSERT OR IGNORE INTO providers (id, label, supports_byok, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `
    );
    const insertModel = sqlite.prepare(
        `
            INSERT OR IGNORE INTO provider_models (id, provider_id, label, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `
    );
    const insertTool = sqlite.prepare(
        `
            INSERT OR IGNORE INTO tools_catalog (id, label, description, permission_policy, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `
    );
    const insertMcpServer = sqlite.prepare(
        `
            INSERT OR IGNORE INTO mcp_servers
                (id, label, auth_mode, connection_state, auth_state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `
    );
    const insertSettingIfMissing = sqlite.prepare(
        `
            INSERT OR IGNORE INTO settings (id, profile_id, key, value_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `
    );

    for (const provider of PROVIDER_SEED) {
        insertProvider.run(provider.id, provider.label, provider.supportsByok, now, now);
    }

    for (const model of MODEL_SEED) {
        insertModel.run(model.id, model.providerId, model.label, now, now);
    }

    for (const tool of TOOL_SEED) {
        insertTool.run(tool.id, tool.label, tool.description, tool.permissionPolicy, now, now);
    }

    for (const server of MCP_SERVER_SEED) {
        insertMcpServer.run(
            server.id,
            server.label,
            server.authMode,
            server.connectionState,
            server.authState,
            now,
            now
        );
    }

    insertSettingIfMissing.run(
        'setting_default_provider',
        GLOBAL_PROFILE_ID,
        'default_provider_id',
        JSON.stringify(DEFAULT_PROVIDER_ID),
        now
    );
    insertSettingIfMissing.run(
        'setting_default_model',
        GLOBAL_PROFILE_ID,
        'default_model_id',
        JSON.stringify(DEFAULT_MODEL_ID),
        now
    );
}

function createPersistenceContext(dbPath: string): PersistenceContext {
    ensureParentDirectory(dbPath);

    const sqlite = new BetterSqlite3(dbPath);
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');

    applySqlMigrations(sqlite);
    seedRuntimeData(sqlite);

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

    if (options.resetDb && !isMemoryDbPath(dbPath) && existsSync(dbPath)) {
        rmSync(dbPath, { force: true });
    }

    if (
        persistenceContext &&
        !options.forceReinitialize &&
        persistenceContext.dbPath === dbPath
    ) {
        return persistenceContext;
    }

    if (persistenceContext) {
        closePersistence();
    }

    persistenceContext = createPersistenceContext(dbPath);
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

export function getGlobalProfileId(): string {
    return GLOBAL_PROFILE_ID;
}
