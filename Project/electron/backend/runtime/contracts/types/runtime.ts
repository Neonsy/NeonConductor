import type { ContextBudget, RuntimeResetTarget, StreamEventType } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface StreamEventEnvelope {
    id: EntityId<'evt'>;
    sessionId: EntityId<'sess'>;
    runId: EntityId<'run'>;
    eventType: StreamEventType;
    at: string;
    payload: Record<string, unknown>;
}

export interface RuntimeEventsSubscriptionInput {
    afterSequence?: number;
}

export interface WindowStateSubscriptionInput {
    afterSequence?: number;
}

export type RuntimeSnapshotInput = ProfileInput;

export interface RuntimeResetInput {
    target: RuntimeResetTarget;
    profileId?: string;
    workspaceFingerprint?: string;
    dryRun?: boolean;
    confirm?: boolean;
}

export interface RuntimeResetCounts {
    settings: number;
    runtimeEvents: number;
    sessions: number;
    runs: number;
    messages: number;
    messageParts: number;
    runUsage: number;
    permissions: number;
    conversations: number;
    threads: number;
    threadTags: number;
    tags: number;
    diffs: number;
    modeDefinitions: number;
    rulesets: number;
    skillfiles: number;
    marketplacePackages: number;
    marketplaceAssets: number;
    kiloAccountSnapshots: number;
    kiloOrgSnapshots: number;
    secretReferences: number;
    providerAuthStates: number;
    providerAuthFlows: number;
    providerCatalogModels: number;
    providerDiscoverySnapshots: number;
}

export interface RuntimeResetResult {
    dryRun: boolean;
    target: RuntimeResetTarget;
    applied: boolean;
    counts: RuntimeResetCounts;
}

export interface ContextBudgetInput {
    contextBudget: ContextBudget;
}
