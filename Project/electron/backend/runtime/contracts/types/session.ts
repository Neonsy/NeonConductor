import type {
    RuntimeProviderId,
    RuntimeReasoningEffort,
    RuntimeReasoningSummary,
    RuntimeCacheStrategy,
    RuntimeOpenAITransport,
    SessionKind,
    TopLevelTab,
} from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface SessionCreateInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    kind: SessionKind;
}

export interface SessionByIdInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
}

export interface RuntimeReasoningOptions {
    effort: RuntimeReasoningEffort;
    summary: RuntimeReasoningSummary;
    includeEncrypted: boolean;
}

export interface RuntimeCacheOptions {
    strategy: RuntimeCacheStrategy;
    key?: string;
}

export interface RuntimeTransportOptions {
    openai: RuntimeOpenAITransport;
}

export interface RuntimeRunOptions {
    reasoning: RuntimeReasoningOptions;
    cache: RuntimeCacheOptions;
    transport: RuntimeTransportOptions;
}

export interface SessionStartRunInput extends SessionByIdInput {
    prompt: string;
    providerId?: RuntimeProviderId;
    modelId?: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
    runtimeOptions: RuntimeRunOptions;
}

export type SessionListRunsInput = SessionByIdInput;

export interface SessionListMessagesInput extends SessionByIdInput {
    runId?: EntityId<'run'>;
}
