import { messageStore, runStore, sessionStore } from '@/app/backend/persistence/stores';
import { eventMetadata } from '@/app/backend/runtime/services/common/logContext';
import { emitCacheResolutionEvent, emitTransportSelectionEvent } from '@/app/backend/runtime/services/runExecution/eventing';
import type { PreparedRunStart, StartRunInput } from '@/app/backend/runtime/services/runExecution/types';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';

export async function persistRunStart(input: {
    input: StartRunInput;
    prepared: PreparedRunStart;
}): Promise<{
    run: Awaited<ReturnType<typeof runStore.create>>;
    assistantMessageId: string;
}> {
    const run = await runStore.create({
        profileId: input.input.profileId,
        sessionId: input.input.sessionId,
        prompt: input.input.prompt,
        providerId: input.prepared.activeTarget.providerId,
        modelId: input.prepared.activeTarget.modelId,
        authMethod: input.prepared.resolvedAuth.authMethod,
        runtimeOptions: input.input.runtimeOptions,
        cache: input.prepared.resolvedCache,
        transport: {
            selected: input.prepared.initialTransport.selected,
            ...(input.prepared.initialTransport.degraded
                ? {
                      degradedReason: input.prepared.initialTransport.degradedReason,
                  }
                : {}),
        },
    });

    await sessionStore.markRunPending(input.input.profileId, input.input.sessionId, run.id);

    const userMessage = await messageStore.createMessage({
        profileId: input.input.profileId,
        sessionId: input.input.sessionId,
        runId: run.id,
        role: 'user',
    });
    await messageStore.appendPart({
        messageId: userMessage.id,
        partType: 'text',
        payload: {
            text: input.input.prompt,
        },
    });

    const assistantMessage = await messageStore.createMessage({
        profileId: input.input.profileId,
        sessionId: input.input.sessionId,
        runId: run.id,
        role: 'assistant',
    });

    await runtimeEventLogService.append({
        entityType: 'run',
        entityId: run.id,
        eventType: 'run.mode.context',
        payload: {
            runId: run.id,
            sessionId: input.input.sessionId,
            profileId: input.input.profileId,
            topLevelTab: input.input.topLevelTab,
            modeKey: input.input.modeKey,
            workspaceFingerprint: input.input.workspaceFingerprint ?? null,
            mode: {
                id: input.prepared.resolvedMode.mode.id,
                label: input.prepared.resolvedMode.mode.label,
                executionPolicy: input.prepared.resolvedMode.mode.executionPolicy,
            },
        },
        ...eventMetadata({
            requestId: input.input.requestId,
            correlationId: input.input.correlationId,
            origin: 'runtime.runExecution.startRun',
        }),
    });

    await runtimeEventLogService.append({
        entityType: 'run',
        entityId: run.id,
        eventType: 'run.started',
        payload: {
            run,
            sessionId: input.input.sessionId,
            profileId: input.input.profileId,
        },
        ...eventMetadata({
            requestId: input.input.requestId,
            correlationId: input.input.correlationId,
            origin: 'runtime.runExecution.startRun',
        }),
    });

    await emitCacheResolutionEvent({
        runId: run.id,
        profileId: input.input.profileId,
        sessionId: input.input.sessionId,
        cache: input.prepared.resolvedCache,
    });
    await emitTransportSelectionEvent({
        runId: run.id,
        profileId: input.input.profileId,
        sessionId: input.input.sessionId,
        selection: {
            selected: input.prepared.initialTransport.selected,
            requested: input.prepared.initialTransport.requested,
            degraded: input.prepared.initialTransport.degraded,
            ...(input.prepared.initialTransport.degradedReason
                ? { degradedReason: input.prepared.initialTransport.degradedReason }
                : {}),
        },
    });

    return {
        run,
        assistantMessageId: assistantMessage.id,
    };
}
