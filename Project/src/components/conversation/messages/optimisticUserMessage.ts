import type { EntityId } from '@/shared/contracts';

export interface OptimisticConversationUserMessage {
    id: string;
    runId: string;
    sessionId: EntityId<'sess'>;
    createdAt: string;
    prompt: string;
}
