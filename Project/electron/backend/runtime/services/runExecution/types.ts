import type {
    EntityId,
    ModeDefinition,
    ProviderAuthMethod,
    RuntimeProviderId,
    RuntimeRunOptions,
    RunStatus,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';
import type { RunExecutionErrorCode } from '@/app/backend/runtime/services/runExecution/errors';

export interface StartRunInput {
    profileId: string;
    sessionId: EntityId<'sess'>;
    prompt: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
    requestId?: string;
    correlationId?: string;
    runtimeOptions: RuntimeRunOptions;
    providerId?: RuntimeProviderId;
    modelId?: string;
}

export interface ResolvedRunTarget {
    providerId: RuntimeProviderId;
    modelId: string;
}

export interface ResolvedRunAuth {
    authMethod: ProviderAuthMethod | 'none';
    apiKey?: string;
    accessToken?: string;
    organizationId?: string;
}

export interface RunCacheResolution {
    strategy: RuntimeRunOptions['cache']['strategy'];
    key?: string;
    applied: boolean;
    reason?: string;
}

export interface RunContextMessage {
    role: 'system' | 'user' | 'assistant';
    text: string;
}

export interface RunContext {
    messages: RunContextMessage[];
    digest: string;
}

export interface RunTransportResolution {
    requested: RuntimeRunOptions['transport']['openai'];
    selected: 'responses' | 'chat_completions';
    degraded: boolean;
    degradedReason?: string;
}

export type ResolvedKiloRouting =
    | {
          mode: 'dynamic';
          sort: 'default' | 'price' | 'throughput' | 'latency';
      }
    | {
          mode: 'pinned';
          providerId: string;
      };

export interface PreparedRunStart {
    resolvedMode: {
        mode: ModeDefinition;
    };
    activeTarget: ResolvedRunTarget;
    resolvedAuth: ResolvedRunAuth;
    resolvedCache: RunCacheResolution;
    initialTransport: RunTransportResolution;
    runContext?: RunContext;
    kiloRouting?: ResolvedKiloRouting;
}

export type StartRunResult =
    | {
          accepted: false;
          reason: 'not_found' | 'already_running' | 'rejected';
          code?: RunExecutionErrorCode;
          message?: string;
      }
    | {
          accepted: true;
          runId: EntityId<'run'>;
          runStatus: RunStatus;
      };
