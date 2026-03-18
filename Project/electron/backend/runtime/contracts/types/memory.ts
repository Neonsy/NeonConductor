import type {
    MemoryCreatedByKind,
    MemoryScopeKind,
    MemoryState,
    MemoryType,
} from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface MemoryRecord {
    id: EntityId<'mem'>;
    profileId: string;
    memoryType: MemoryType;
    scopeKind: MemoryScopeKind;
    state: MemoryState;
    createdByKind: MemoryCreatedByKind;
    title: string;
    bodyMarkdown: string;
    summaryText?: string;
    metadata: Record<string, unknown>;
    workspaceFingerprint?: string;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
    supersededByMemoryId?: EntityId<'mem'>;
    createdAt: string;
    updatedAt: string;
}

export interface MemoryCreateInput extends ProfileInput {
    memoryType: MemoryType;
    scopeKind: MemoryScopeKind;
    createdByKind: MemoryCreatedByKind;
    title: string;
    bodyMarkdown: string;
    summaryText?: string;
    metadata?: Record<string, unknown>;
    workspaceFingerprint?: string;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
}

export interface MemoryListInput extends ProfileInput {
    memoryType?: MemoryType;
    scopeKind?: MemoryScopeKind;
    state?: MemoryState;
    workspaceFingerprint?: string;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
}

export interface MemoryByIdInput extends ProfileInput {
    memoryId: EntityId<'mem'>;
}

export type MemoryDisableInput = MemoryByIdInput;

export interface MemorySupersedeInput extends MemoryByIdInput {
    createdByKind: MemoryCreatedByKind;
    title: string;
    bodyMarkdown: string;
    summaryText?: string;
    metadata?: Record<string, unknown>;
}
