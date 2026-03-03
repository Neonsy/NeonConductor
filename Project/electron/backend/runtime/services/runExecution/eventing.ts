import { messageStore } from '@/app/backend/persistence/stores';
import type { ProviderRuntimePart, ProviderRuntimeTransportSelection } from '@/app/backend/providers/types';
import { isReasoningPart } from '@/app/backend/runtime/services/runExecution/parts';
import type { RunCacheResolution } from '@/app/backend/runtime/services/runExecution/types';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';

export async function emitCacheResolutionEvent(input: {
    runId: string;
    profileId: string;
    sessionId: string;
    cache: RunCacheResolution;
}): Promise<void> {
    await runtimeEventLogService.append({
        entityType: 'run',
        entityId: input.runId,
        eventType: input.cache.applied ? 'run.cache.applied' : 'run.cache.skipped',
        payload: {
            runId: input.runId,
            profileId: input.profileId,
            sessionId: input.sessionId,
            cache: input.cache,
        },
    });
}

export async function emitTransportSelectionEvent(input: {
    runId: string;
    profileId: string;
    sessionId: string;
    selection: ProviderRuntimeTransportSelection;
}): Promise<void> {
    await runtimeEventLogService.append({
        entityType: 'run',
        entityId: input.runId,
        eventType: 'run.transport.selected',
        payload: {
            runId: input.runId,
            profileId: input.profileId,
            sessionId: input.sessionId,
            transport: input.selection,
        },
    });
}

export async function emitPartEvents(input: {
    runId: string;
    profileId: string;
    sessionId: string;
    messageId: string;
    part: ProviderRuntimePart;
}): Promise<void> {
    const appended = await messageStore.appendPart({
        messageId: input.messageId,
        partType: input.part.partType,
        payload: input.part.payload,
    });

    await runtimeEventLogService.append({
        entityType: 'run',
        entityId: input.runId,
        eventType: 'run.part.appended',
        payload: {
            runId: input.runId,
            messageId: input.messageId,
            part: appended,
        },
    });

    if (isReasoningPart(input.part.partType)) {
        await runtimeEventLogService.append({
            entityType: 'run',
            entityId: input.runId,
            eventType: 'run.reasoning.appended',
            payload: {
                runId: input.runId,
                profileId: input.profileId,
                sessionId: input.sessionId,
                partType: input.part.partType,
                part: appended,
            },
        });
    }
}
