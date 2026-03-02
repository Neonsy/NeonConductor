import { createEntityId } from '@/app/backend/runtime/contracts';

import type {
    ConversationScope,
    EntityId,
    PermissionPolicy,
    RunStatus,
    SessionKind,
} from '@/app/backend/runtime/contracts';

export interface SessionTurn {
    runId: EntityId<'run'>;
    prompt: string;
    status: Exclude<RunStatus, 'idle'>;
    createdAt: string;
    updatedAt: string;
}

export interface SessionRecord {
    id: EntityId<'sess'>;
    scope: ConversationScope;
    kind: SessionKind;
    runStatus: RunStatus;
    turns: SessionTurn[];
    createdAt: string;
    updatedAt: string;
    pendingCompletionRunId: EntityId<'run'> | null;
}

export interface PermissionRecord {
    id: EntityId<'perm'>;
    policy: PermissionPolicy;
    resource: string;
    decision: 'pending' | 'granted' | 'denied';
    createdAt: string;
    updatedAt: string;
    rationale?: string;
}

export interface ProviderRecord {
    id: string;
    label: string;
    supportsByok: boolean;
}

export interface ProviderModelRecord {
    id: string;
    providerId: string;
    label: string;
}

export interface ToolRecord {
    id: string;
    label: string;
    description: string;
    permissionPolicy: PermissionPolicy;
}

export interface McpServerRecord {
    id: string;
    label: string;
    authMode: 'none' | 'token';
    connectionState: 'disconnected' | 'connected';
    authState: 'unauthenticated' | 'authenticated';
}

export interface RuntimeState {
    sessions: Map<EntityId<'sess'>, SessionRecord>;
    permissions: Map<EntityId<'perm'>, PermissionRecord>;
    providers: ProviderRecord[];
    modelsByProvider: Map<string, ProviderModelRecord[]>;
    defaultProviderId: string;
    defaultModelId: string;
    tools: ToolRecord[];
    mcpServers: Map<string, McpServerRecord>;
}

const PROVIDER_SEED: ProviderRecord[] = [
    {
        id: 'kilo',
        label: 'Kilo',
        supportsByok: false,
    },
    {
        id: 'openai',
        label: 'OpenAI',
        supportsByok: true,
    },
];

const MODEL_SEED: ProviderModelRecord[] = [
    {
        id: 'kilo/auto',
        providerId: 'kilo',
        label: 'Kilo Auto',
    },
    {
        id: 'kilo/code',
        providerId: 'kilo',
        label: 'Kilo Code',
    },
    {
        id: 'openai/gpt-5',
        providerId: 'openai',
        label: 'GPT-5',
    },
    {
        id: 'openai/gpt-5-mini',
        providerId: 'openai',
        label: 'GPT-5 Mini',
    },
];

const TOOL_SEED: ToolRecord[] = [
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
];

const MCP_SERVER_SEED: McpServerRecord[] = [
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
];

function cloneProviderSeed(): ProviderRecord[] {
    return PROVIDER_SEED.map((provider) => ({ ...provider }));
}

function cloneModelSeedByProvider(): Map<string, ProviderModelRecord[]> {
    const grouped = new Map<string, ProviderModelRecord[]>();
    for (const model of MODEL_SEED) {
        const current = grouped.get(model.providerId) ?? [];
        current.push({ ...model });
        grouped.set(model.providerId, current);
    }

    return grouped;
}

function cloneToolSeed(): ToolRecord[] {
    return TOOL_SEED.map((tool) => ({ ...tool }));
}

function cloneMcpServerSeed(): Map<string, McpServerRecord> {
    return new Map(MCP_SERVER_SEED.map((server) => [server.id, { ...server }]));
}

function createInitialRuntimeState(): RuntimeState {
    return {
        sessions: new Map(),
        permissions: new Map(),
        providers: cloneProviderSeed(),
        modelsByProvider: cloneModelSeedByProvider(),
        defaultProviderId: 'kilo',
        defaultModelId: 'kilo/auto',
        tools: cloneToolSeed(),
        mcpServers: cloneMcpServerSeed(),
    };
}

let runtimeState = createInitialRuntimeState();

export function getRuntimeState(): RuntimeState {
    return runtimeState;
}

export function resetRuntimeState(): void {
    runtimeState = createInitialRuntimeState();
}

export function createSessionRecord(scope: ConversationScope, kind: SessionKind): SessionRecord {
    const now = new Date().toISOString();

    return {
        id: createEntityId('sess'),
        scope,
        kind,
        runStatus: 'idle',
        turns: [],
        createdAt: now,
        updatedAt: now,
        pendingCompletionRunId: null,
    };
}

export function createPermissionRecord(
    policy: PermissionPolicy,
    resource: string,
    rationale?: string
): PermissionRecord {
    const now = new Date().toISOString();

    return {
        id: createEntityId('perm'),
        policy,
        resource,
        decision: 'pending',
        createdAt: now,
        updatedAt: now,
        ...(rationale ? { rationale } : {}),
    };
}
