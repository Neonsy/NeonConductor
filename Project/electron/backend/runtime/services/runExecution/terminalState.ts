import { runStore, sessionStore } from '@/app/backend/persistence/stores';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

export async function moveRunToAbortedState(input: {
    profileId: string;
    sessionId: string;
    runId: string;
    logMessage: string;
}): Promise<void> {
    await runStore.finalize(input.runId, {
        status: 'aborted',
    });
    await sessionStore.markRunTerminal(input.profileId, input.sessionId, 'aborted');
    await runtimeEventLogService.append(
        runtimeStatusEvent({
        entityType: 'run',
        domain: 'run',
        entityId: input.runId,
        eventType: 'run.aborted',
        payload: {
            runId: input.runId,
            sessionId: input.sessionId,
            profileId: input.profileId,
        },
        })
    );
    appLog.info({
        tag: 'run-execution',
        message: input.logMessage,
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
    });
}

export async function moveRunToFailedState(input: {
    profileId: string;
    sessionId: string;
    runId: string;
    errorCode: string;
    errorMessage: string;
    logMessage: string;
}): Promise<void> {
    await runStore.finalize(input.runId, {
        status: 'error',
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
    });
    await sessionStore.markRunTerminal(input.profileId, input.sessionId, 'error');
    await runtimeEventLogService.append(
        runtimeStatusEvent({
        entityType: 'run',
        domain: 'run',
        entityId: input.runId,
        eventType: 'run.failed',
        payload: {
            runId: input.runId,
            sessionId: input.sessionId,
            profileId: input.profileId,
            errorCode: input.errorCode,
            errorMessage: input.errorMessage,
        },
        })
    );
    appLog.warn({
        tag: 'run-execution',
        message: input.logMessage,
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
    });
}
