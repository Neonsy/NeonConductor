import { useChat } from '@tanstack/ai-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import {
    type ConversationTanstackMessage,
    projectOptimisticConversationUserMessage,
} from '@/web/components/conversation/messages/tanstackMessageBridge';
import type { OptimisticConversationUserMessage } from '@/web/components/conversation/messages/optimisticUserMessage';
import {
    applyRuntimeEventToTanstackTranscriptState,
    hydrateTanstackTranscriptState,
    projectTanstackTranscriptState,
    type TanstackTranscriptState,
} from '@/web/components/conversation/messages/tanstackTranscriptState';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';

import type { UseChatOptions } from '@tanstack/ai-react';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

const noOpConnection: UseChatOptions<readonly []>['connection'] = {
    async *connect() {
        return;
    },
};

function deriveChatSessionId(messages: MessageRecord[]): string {
    return messages[0]?.sessionId ?? 'sess_detached';
}

export function useConversationTanstackMessages(input: {
    sessionId?: string;
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
    optimisticUserMessage?: OptimisticConversationUserMessage;
}): ConversationTanstackMessage[] {
    const runtimeEvents = useRuntimeEventStreamStore((state) => state.events);
    const baselineState = useMemo(
        () => hydrateTanstackTranscriptState(input.messages, input.partsByMessageId),
        [input.messages, input.partsByMessageId]
    );
    const baselineMessages = useMemo(() => projectTanstackTranscriptState(baselineState), [baselineState]);
    const chat = useChat({
        id: input.sessionId ?? deriveChatSessionId(input.messages),
        connection: noOpConnection,
        initialMessages: baselineMessages.map((message) => message.uiMessage),
    });
    const chatMessages = chat.messages;
    const setChatMessages = chat.setMessages;
    const [transcriptState, setTranscriptState] = useState<TanstackTranscriptState>(baselineState);
    const transcriptStateRef = useRef(transcriptState);
    const lastAppliedSequenceRef = useRef(0);
    const baselineSessionId = baselineState.sessionId;

    useEffect(() => {
        transcriptStateRef.current = transcriptState;
    }, [transcriptState]);

    const syncTranscriptState = useEffectEvent((nextState: TanstackTranscriptState) => {
        transcriptStateRef.current = nextState;
        setTranscriptState(nextState);
        setChatMessages(projectTanstackTranscriptState(nextState).map((message) => message.uiMessage));
    });

    useEffect(() => {
        if (
            transcriptStateRef.current.sessionId !== baselineSessionId ||
            transcriptStateRef.current.digest !== baselineState.digest
        ) {
            lastAppliedSequenceRef.current = useRuntimeEventStreamStore.getState().lastSequence;
            syncTranscriptState(baselineState);
        }
    }, [baselineSessionId, baselineState, syncTranscriptState]);

    useEffect(() => {
        if (baselineSessionId === null || runtimeEvents.length === 0) {
            return;
        }

        const currentState = transcriptStateRef.current;
        if (currentState.sessionId !== baselineSessionId) {
            return;
        }

        let nextState = currentState;
        let lastAppliedSequence = lastAppliedSequenceRef.current;

        for (const event of runtimeEvents) {
            if (event.sequence <= lastAppliedSequence) {
                continue;
            }

            if (lastAppliedSequence > 0 && event.sequence > lastAppliedSequence + 1) {
                lastAppliedSequenceRef.current = runtimeEvents.at(-1)?.sequence ?? lastAppliedSequence;
                syncTranscriptState(baselineState);
                return;
            }

            const appliedState = applyRuntimeEventToTanstackTranscriptState(nextState, event);
            if (appliedState === 'resync') {
                lastAppliedSequenceRef.current = runtimeEvents.at(-1)?.sequence ?? event.sequence;
                syncTranscriptState(baselineState);
                return;
            }

            nextState = appliedState;
            lastAppliedSequence = event.sequence;
        }

        if (lastAppliedSequence === lastAppliedSequenceRef.current) {
            return;
        }

        lastAppliedSequenceRef.current = lastAppliedSequence;
        if (nextState !== currentState) {
            syncTranscriptState(nextState);
        }
    }, [baselineSessionId, baselineState, runtimeEvents, syncTranscriptState]);

    return useMemo(
        () => {
            const uiMessagesById = new Map(chatMessages.map((message) => [message.id, message]));
            const projectedMessages = projectTanstackTranscriptState(transcriptState).map((message) => {
                const uiMessage = uiMessagesById.get(message.id);
                return uiMessage ? { ...message, uiMessage } : message;
            });

            const resolvedSessionId = transcriptState.sessionId ?? input.sessionId ?? null;
            if (!input.optimisticUserMessage || resolvedSessionId !== input.optimisticUserMessage.sessionId) {
                return projectedMessages;
            }

            return [...projectedMessages, projectOptimisticConversationUserMessage(input.optimisticUserMessage)];
        },
        [chatMessages, input.optimisticUserMessage, input.sessionId, transcriptState]
    );
}
