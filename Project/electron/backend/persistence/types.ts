import type { EntityId, PermissionPolicy, RunStatus } from '@/app/backend/runtime/contracts';

export interface SessionSummaryRecord {
    id: EntityId<'sess'>;
    scope: 'detached' | 'workspace';
    kind: 'local' | 'worktree' | 'cloud';
    runStatus: RunStatus;
    turnCount: number;
    createdAt: string;
    updatedAt: string;
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

export interface RuntimeEventRecordV1 {
    sequence: number;
    eventId: EntityId<'evt'>;
    entityType: string;
    entityId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

export interface RuntimeSnapshotV1 {
    generatedAt: string;
    lastSequence: number;
    sessions: SessionSummaryRecord[];
    permissions: PermissionRecord[];
    providers: Array<ProviderRecord & { isDefault: boolean }>;
    providerModels: ProviderModelRecord[];
    tools: ToolRecord[];
    mcpServers: McpServerRecord[];
    defaults: {
        providerId: string;
        modelId: string;
    };
}

