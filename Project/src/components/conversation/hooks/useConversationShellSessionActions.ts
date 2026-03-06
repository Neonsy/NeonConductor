import { useState } from 'react';

import {
    applySessionModelOverride,
    applySessionProviderOverride,
} from '@/web/components/conversation/sessionTargetState';
import { isEntityId } from '@/web/components/conversation/shellHelpers';

import type { SessionCreateInput, RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { EntityId } from '@/app/backend/runtime/contracts';

interface UseConversationShellSessionActionsInput {
    profileId: string;
    selectedThreadId: string | undefined;
    selectedSessionId: string | undefined;
    createSession: (input: SessionCreateInput) => Promise<
        | { created: false; reason: string }
        | {
              created: true;
              session: {
                  id: EntityId<'sess'>;
              };
          }
    >;
    onClearError: () => void;
    onError: (message: string) => void;
    onSelectSessionId: (sessionId: string | undefined) => void;
    onSelectRunId: (runId: string | undefined) => void;
    refetchSessionIndex: () => void;
}

export function useConversationShellSessionActions(input: UseConversationShellSessionActionsInput) {
    const [sessionTargetBySessionId, setSessionTargetBySessionId] = useState<
        Record<string, { providerId?: RuntimeProviderId; modelId?: string }>
    >({});

    return {
        sessionOverride: input.selectedSessionId ? sessionTargetBySessionId[input.selectedSessionId] : undefined,
        resetSessionActions: () => {
            setSessionTargetBySessionId({});
        },
        onSelectSession: (sessionId: string) => {
            input.onClearError();
            input.onSelectSessionId(sessionId);
        },
        onProviderChange: (providerId: RuntimeProviderId, firstModelId?: string) => {
            if (!isEntityId(input.selectedSessionId, 'sess')) {
                return;
            }

            const sessionId = input.selectedSessionId;
            setSessionTargetBySessionId((current) => applySessionProviderOverride(current, sessionId, providerId, firstModelId));
            input.onClearError();
        },
        onModelChange: (providerId: RuntimeProviderId | undefined, modelId: string) => {
            if (!isEntityId(input.selectedSessionId, 'sess') || !providerId || modelId.trim().length === 0) {
                return;
            }

            const sessionId = input.selectedSessionId;
            setSessionTargetBySessionId((current) => applySessionModelOverride(current, sessionId, providerId, modelId));
            input.onClearError();
        },
        onCreateSession: () => {
            if (!isEntityId(input.selectedThreadId, 'thr')) {
                return;
            }

            void input.createSession({
                profileId: input.profileId,
                threadId: input.selectedThreadId,
                kind: 'local',
            }).then((result) => {
                if (!result.created) {
                    input.onError('Selected thread no longer exists.');
                    return;
                }

                input.onSelectSessionId(result.session.id);
                input.onSelectRunId(undefined);
                input.onClearError();
                input.refetchSessionIndex();
            });
        },
    };
}
