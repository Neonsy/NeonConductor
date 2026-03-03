import type {
    EntityId,
    KiloAccountContext,
    MarketplacePackage,
    ModeDefinition,
    ProviderAuthFlowStatus,
    ProviderAuthFlowType,
    ProviderAuthMethod,
    ProviderAuthState,
    PermissionPolicy,
    RuntimeProviderId,
    RulesetDefinition,
    RunStatus,
    SecretReference,
    SkillfileDefinition,
} from '@/app/backend/runtime/contracts';

export interface SessionSummaryRecord {
    id: EntityId<'sess'>;
    profileId: string;
    scope: 'detached' | 'workspace';
    kind: 'local' | 'worktree' | 'cloud';
    workspaceFingerprint?: string;
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
    id: RuntimeProviderId;
    label: string;
    supportsByok: boolean;
}

export interface ProviderModelRecord {
    id: string;
    providerId: RuntimeProviderId;
    label: string;
}

export interface ProviderAuthStateRecord {
    profileId: string;
    providerId: RuntimeProviderId;
    authMethod: ProviderAuthMethod | 'none';
    authState: ProviderAuthState;
    accountId?: string;
    organizationId?: string;
    tokenExpiresAt?: string;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    updatedAt: string;
}

export interface ProviderAuthFlowRecord {
    id: string;
    profileId: string;
    providerId: RuntimeProviderId;
    flowType: ProviderAuthFlowType;
    authMethod: Extract<ProviderAuthMethod, 'device_code' | 'oauth_pkce' | 'oauth_device'>;
    nonce?: string;
    state?: string;
    codeVerifier?: string;
    redirectUri?: string;
    deviceCode?: string;
    userCode?: string;
    verificationUri?: string;
    pollIntervalSeconds?: number;
    expiresAt: string;
    status: ProviderAuthFlowStatus;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    createdAt: string;
    updatedAt: string;
    consumedAt?: string;
}

export interface ProviderDiscoverySnapshotRecord {
    profileId: string;
    providerId: string;
    kind: 'models' | 'providers';
    status: 'ok' | 'error';
    etag?: string;
    payload: Record<string, unknown>;
    fetchedAt: string;
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

export type RuntimeEntityType =
    | 'session'
    | 'run'
    | 'permission'
    | 'provider'
    | 'tool'
    | 'mcp'
    | 'runtime'
    | 'conversation'
    | 'thread'
    | 'tag'
    | 'diff';

export interface RuntimeEventRecordV1 {
    sequence: number;
    eventId: EntityId<'evt'>;
    entityType: RuntimeEntityType;
    entityId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

export interface ConversationRecord {
    id: string;
    scope: 'detached' | 'workspace';
    workspaceFingerprint?: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface ThreadRecord {
    id: string;
    conversationId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface TagRecord {
    id: string;
    label: string;
    createdAt: string;
    updatedAt: string;
}

export interface ThreadTagRecord {
    threadId: string;
    tagId: string;
    createdAt: string;
}

export interface DiffRecord {
    id: string;
    sessionId: string;
    runId: string | null;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface RunRecord {
    id: EntityId<'run'>;
    sessionId: EntityId<'sess'>;
    profileId: string;
    prompt: string;
    status: RunStatus;
    providerId?: RuntimeProviderId;
    modelId?: string;
    authMethod?: ProviderAuthMethod | 'none';
    startedAt?: string;
    completedAt?: string;
    abortedAt?: string;
    errorCode?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MessageRecord {
    id: EntityId<'msg'>;
    profileId: string;
    sessionId: EntityId<'sess'>;
    runId: EntityId<'run'>;
    role: 'user' | 'assistant' | 'system' | 'tool';
    createdAt: string;
    updatedAt: string;
}

export interface MessagePartRecord {
    id: EntityId<'part'>;
    messageId: EntityId<'msg'>;
    sequence: number;
    partType: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

export interface RunUsageRecord {
    runId: EntityId<'run'>;
    providerId: RuntimeProviderId;
    modelId: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
    billedVia: 'kilo_gateway' | 'openai_api' | 'openai_subscription';
    recordedAt: string;
}

export interface ProviderUsageSummary {
    providerId: RuntimeProviderId;
    runCount: number;
    totalTokens: number;
    totalCostMicrounits: number;
}

export type ModeDefinitionRecord = ModeDefinition;

export type RulesetDefinitionRecord = RulesetDefinition;

export type SkillfileDefinitionRecord = SkillfileDefinition;

export type MarketplacePackageRecord = MarketplacePackage;

export type KiloAccountContextRecord = KiloAccountContext;

export type SecretReferenceRecord = SecretReference;

export interface RuntimeSnapshotV1 {
    generatedAt: string;
    lastSequence: number;
    sessions: SessionSummaryRecord[];
    runs: RunRecord[];
    messages: MessageRecord[];
    messageParts: MessagePartRecord[];
    runUsage: RunUsageRecord[];
    providerUsageSummaries: ProviderUsageSummary[];
    permissions: PermissionRecord[];
    providers: Array<ProviderRecord & { isDefault: boolean }>;
    providerModels: ProviderModelRecord[];
    providerAuthStates: ProviderAuthStateRecord[];
    providerAuthFlows: ProviderAuthFlowRecord[];
    providerDiscoverySnapshots: ProviderDiscoverySnapshotRecord[];
    tools: ToolRecord[];
    mcpServers: McpServerRecord[];
    conversations: ConversationRecord[];
    threads: ThreadRecord[];
    tags: TagRecord[];
    threadTags: ThreadTagRecord[];
    diffs: DiffRecord[];
    modeDefinitions: ModeDefinitionRecord[];
    rulesets: RulesetDefinitionRecord[];
    skillfiles: SkillfileDefinitionRecord[];
    marketplacePackages: MarketplacePackageRecord[];
    kiloAccountContext: KiloAccountContextRecord;
    secretReferences: SecretReferenceRecord[];
    defaults: {
        providerId: string;
        modelId: string;
    };
}
