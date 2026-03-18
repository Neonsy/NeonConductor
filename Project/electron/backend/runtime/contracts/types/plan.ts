import type {
    OrchestratorExecutionStrategy,
    PlanStatus,
    RuntimeProviderId,
    TopLevelTab,
} from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';
import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts/types/session';

export interface PlanQuestion {
    id: string;
    question: string;
    answer?: string;
}

export interface PlanDraftItemInput {
    description: string;
}

export interface PlanStartInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
    topLevelTab: TopLevelTab;
    modeKey: string;
    prompt: string;
    workspaceFingerprint?: string;
}

export interface PlanGetInput extends ProfileInput {
    planId: EntityId<'plan'>;
}

export interface PlanGetActiveInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
    topLevelTab: TopLevelTab;
}

export interface PlanAnswerQuestionInput extends PlanGetInput {
    questionId: string;
    answer: string;
}

export interface PlanReviseInput extends PlanGetInput {
    summaryMarkdown: string;
    items: PlanDraftItemInput[];
}

export type PlanApproveInput = PlanGetInput;

export interface PlanImplementInput extends PlanGetInput {
    runtimeOptions: RuntimeRunOptions;
    executionStrategy?: OrchestratorExecutionStrategy;
    providerId?: RuntimeProviderId;
    modelId?: string;
    workspaceFingerprint?: string;
}

export interface PlanRecordView {
    id: EntityId<'plan'>;
    profileId: string;
    sessionId: EntityId<'sess'>;
    topLevelTab: TopLevelTab;
    modeKey: string;
    status: PlanStatus;
    sourcePrompt: string;
    summaryMarkdown: string;
    questions: PlanQuestion[];
    items: Array<{
        id: EntityId<'step'>;
        sequence: number;
        description: string;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
        runId?: EntityId<'run'>;
        errorMessage?: string;
    }>;
    workspaceFingerprint?: string;
    implementationRunId?: EntityId<'run'>;
    orchestratorRunId?: EntityId<'orch'>;
    approvedAt?: string;
    implementedAt?: string;
    createdAt: string;
    updatedAt: string;
}
