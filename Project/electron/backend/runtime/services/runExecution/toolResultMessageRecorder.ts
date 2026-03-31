import { Buffer } from 'node:buffer';

import { messageStore, toolResultArtifactStore } from '@/app/backend/persistence/stores';
import {
    emitMessageCreatedEvent,
    emitMessagePartAppendedEvent,
} from '@/app/backend/runtime/services/runExecution/eventing';
import { prepareToolResultPersistence } from '@/app/backend/runtime/services/toolExecution/toolOutputCompressionPolicy';
import type { ToolInvocationOutcome } from '@/app/backend/runtime/services/toolExecution/types';
import type { EntityId } from '@/shared/contracts';
import type { ProviderRuntimeInput } from '@/app/backend/providers/types';
import { appLog } from '@/app/main/logging';

import type { ExecutableToolCall } from '@/app/backend/runtime/services/runExecution/assistantTurnCollector';

type ProviderContextMessage = NonNullable<ProviderRuntimeInput['contextMessages']>[number];

async function createRuntimeMessage(input: {
    profileId: string;
    sessionId: EntityId<'sess'>;
    runId: EntityId<'run'>;
    role: 'assistant' | 'tool';
}): Promise<Awaited<ReturnType<typeof messageStore.createMessage>>> {
    const message = await messageStore.createMessage({
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
        role: input.role,
    });
    await emitMessageCreatedEvent({
        runId: input.runId,
        profileId: input.profileId,
        sessionId: input.sessionId,
        message,
    });
    return message;
}

export interface ToolResultContext {
    message: ProviderContextMessage;
    outputText: string;
    isError: boolean;
}

export async function persistToolResultMessage(input: {
    profileId: string;
    sessionId: EntityId<'sess'>;
    runId: EntityId<'run'>;
    toolCall: ExecutableToolCall;
    toolOutcome: ToolInvocationOutcome;
}): Promise<ToolResultContext> {
    const toolMessage = await createRuntimeMessage({
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
        role: 'tool',
    });
    const persistedResult = prepareToolResultPersistence({
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
        toolName: input.toolCall.toolName,
        toolOutcome: input.toolOutcome,
    });
    const recordedPart = await messageStore.createPart({
        messageId: toolMessage.id,
        partType: 'tool_result',
        payload: {
            callId: input.toolCall.callId,
            toolName: input.toolCall.toolName,
            outputText: persistedResult.outputText,
            isError: persistedResult.isError,
            result: persistedResult.normalizedPayload,
            ...persistedResult.payloadArtifactMetadata,
        },
    });
    await emitMessagePartAppendedEvent({
        runId: input.runId,
        profileId: input.profileId,
        sessionId: input.sessionId,
        messageId: toolMessage.id,
        part: recordedPart,
    });

    if (persistedResult.artifactPersistenceCandidate) {
        const artifact = await toolResultArtifactStore.create({
            messagePartId: recordedPart.id,
            ...persistedResult.artifactPersistenceCandidate,
        });
        appLog.debug({
            tag: 'tool-output-artifacts',
            message: 'Artifactized tool result for prompt history.',
            messagePartId: artifact.messagePartId,
            profileId: input.profileId,
            sessionId: input.sessionId,
            toolName: input.toolCall.toolName,
            storageKind: artifact.storageKind,
            totalBytes: artifact.totalBytes,
            previewBytes: Buffer.byteLength(persistedResult.outputText, 'utf8'),
        });
    } else {
        appLog.debug({
            tag: 'tool-output-artifacts',
            message: 'Stored inline tool result preview without artifact row.',
            profileId: input.profileId,
            sessionId: input.sessionId,
            toolName: input.toolCall.toolName,
            previewBytes: Buffer.byteLength(persistedResult.outputText, 'utf8'),
        });
    }

    return {
        message: {
            role: 'tool',
            parts: [
                {
                    type: 'tool_result',
                    callId: input.toolCall.callId,
                    toolName: input.toolCall.toolName,
                    outputText: persistedResult.outputText,
                    isError: persistedResult.isError,
                },
            ],
        },
        outputText: persistedResult.outputText,
        isError: persistedResult.isError,
    };
}
