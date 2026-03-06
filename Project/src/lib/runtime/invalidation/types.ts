import { trpc } from '@/web/trpc/client';

import type { EntityId, RuntimeProviderId, TopLevelTab } from '@/app/backend/runtime/contracts';

export type TrpcUtils = ReturnType<typeof trpc.useUtils>;

export interface ConversationSelectionState {
    selectedSessionId: EntityId<'sess'> | undefined;
    selectedRunId: EntityId<'run'> | undefined;
}

export interface RuntimeEventContext {
    profileId: string | undefined;
    sessionId: EntityId<'sess'> | undefined;
    runId: EntityId<'run'> | undefined;
    threadId: EntityId<'thr'> | undefined;
    tagId: EntityId<'tag'> | undefined;
    providerId: RuntimeProviderId | undefined;
    modelId: string | undefined;
    topLevelTab: TopLevelTab | undefined;
    selection: ConversationSelectionState;
}
