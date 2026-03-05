import type {
    EntityId,
    ProviderAuthMethod,
    RuntimeProviderId,
    RuntimeRunOptions,
    RunStatus,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';

export interface StartRunInput {
    profileId: string;
    sessionId: EntityId<'sess'>;
    prompt: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
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

export interface ChatContextMessage {
    role: 'system' | 'user' | 'assistant';
    text: string;
}

export interface RunTransportResolution {
    requested: RuntimeRunOptions['transport']['openai'];
    selected: 'responses' | 'chat_completions';
    degraded: boolean;
    degradedReason?: string;
}

export type StartRunResult =
    | {
          accepted: false;
          reason: 'not_found' | 'already_running';
      }
    | {
          accepted: true;
          runId: EntityId<'run'>;
          runStatus: RunStatus;
      };
