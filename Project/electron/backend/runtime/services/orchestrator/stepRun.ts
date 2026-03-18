import { conversationStore, runStore, sessionStore, threadStore } from '@/app/backend/persistence/stores';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import type {
    ConversationRecord,
    OrchestratorStepRecord,
    PlanRecord,
    SessionSummaryRecord,
    ThreadRecord,
} from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { eventMetadata } from '@/app/backend/runtime/services/common/logContext';
import { runtimeUpsertEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';

interface OrchestratorRootExecutionContext {
    bucket: ConversationRecord;
    rootThread: ThreadRecord;
}

export interface OrchestratorChildRunStart {
    childThreadId: EntityId<'thr'>;
    childSessionId: EntityId<'sess'>;
    runId: EntityId<'run'>;
}

function toSingleLine(value: string): string {
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ');
}

function buildChildThreadTitle(step: OrchestratorStepRecord): string {
    const titleSource = toSingleLine(step.description);
    const titleSuffix = titleSource.length > 0 ? titleSource : 'Delegated worker task';
    const title = `Step ${String(step.sequence)}: ${titleSuffix}`;
    return title.length <= 88 ? title : `${title.slice(0, 85).trimEnd()}...`;
}

export function buildStepPrompt(plan: PlanRecord, step: OrchestratorStepRecord): string {
    return [
        `Execute step ${String(step.sequence)} from approved orchestrator plan.`,
        '',
        'Plan summary:',
        plan.summaryMarkdown,
        '',
        'Step task:',
        step.description,
    ].join('\n');
}

export async function resolveOrchestratorRootExecutionContext(input: {
    profileId: string;
    sessionId: EntityId<'sess'>;
}): Promise<OrchestratorRootExecutionContext | null> {
    const sessionThread = await threadStore.getBySessionId(input.profileId, input.sessionId);
    if (!sessionThread) {
        return null;
    }

    const bucket = await conversationStore.getBucketById(input.profileId, sessionThread.thread.conversationId);
    if (!bucket) {
        return null;
    }

    return {
        bucket,
        rootThread: sessionThread.thread,
    };
}

async function appendDelegatedChildLaneEvents(input: {
    profileId: string;
    bucket: ConversationRecord;
    thread: ThreadRecord;
    session: SessionSummaryRecord;
}): Promise<void> {
    await runtimeEventLogService.append(
        runtimeUpsertEvent({
            entityType: 'thread',
            domain: 'thread',
            entityId: input.thread.id,
            eventType: 'conversation.thread.created',
            payload: {
                profileId: input.profileId,
                bucket: input.bucket,
                thread: input.thread,
            },
            ...eventMetadata({
                origin: 'runtime.orchestrator.delegateChildLane',
            }),
        })
    );

    await runtimeEventLogService.append(
        runtimeUpsertEvent({
            entityType: 'session',
            domain: 'session',
            entityId: input.session.id,
            eventType: 'session.created',
            payload: {
                session: input.session,
            },
            ...eventMetadata({
                origin: 'runtime.orchestrator.delegateChildLane',
            }),
        })
    );
}

export async function startDelegatedChildRun(input: {
    profileId: string;
    orchestratorRunId: EntityId<'orch'>;
    rootContext: OrchestratorRootExecutionContext;
    plan: PlanRecord;
    step: OrchestratorStepRecord;
    startInput: OrchestratorStartInput;
}): Promise<{ accepted: true; started: OrchestratorChildRunStart } | { accepted: false; reason: string }> {
    const createdThread = await threadStore.create({
        profileId: input.profileId,
        conversationId: input.rootContext.bucket.id,
        title: buildChildThreadTitle(input.step),
        topLevelTab: 'agent',
        parentThreadId: input.rootContext.rootThread.id,
        rootThreadId: input.rootContext.rootThread.id,
        delegatedFromOrchestratorRunId: input.orchestratorRunId,
    });
    if (createdThread.isErr()) {
        return {
            accepted: false,
            reason: createdThread.error.message,
        };
    }

    const createdSession = await sessionStore.create(input.profileId, createdThread.value.id, 'local', {
        delegatedFromOrchestratorRunId: input.orchestratorRunId,
    });
    if (!createdSession.created) {
        await threadStore.deleteDelegatedChildLane({
            profileId: input.profileId,
            threadId: parseEntityId(createdThread.value.id, 'threads.id', 'thr'),
            orchestratorRunId: input.orchestratorRunId,
        });
        return {
            accepted: false,
            reason: `Delegated child session could not be created: ${createdSession.reason}.`,
        };
    }

    const startedRun = await runExecutionService.startRun({
        profileId: input.startInput.profileId,
        sessionId: createdSession.session.id,
        prompt: buildStepPrompt(input.plan, input.step),
        topLevelTab: 'agent',
        modeKey: 'code',
        runtimeOptions: input.startInput.runtimeOptions,
        ...(input.startInput.providerId ? { providerId: input.startInput.providerId } : {}),
        ...(input.startInput.modelId ? { modelId: input.startInput.modelId } : {}),
        ...(input.startInput.workspaceFingerprint
            ? { workspaceFingerprint: input.startInput.workspaceFingerprint }
            : {}),
    });

    if (!startedRun.accepted) {
        await threadStore.deleteDelegatedChildLane({
            profileId: input.profileId,
            threadId: parseEntityId(createdThread.value.id, 'threads.id', 'thr'),
            sessionId: createdSession.session.id,
            orchestratorRunId: input.orchestratorRunId,
        });
        return {
            accepted: false,
            reason: startedRun.reason,
        };
    }

    await appendDelegatedChildLaneEvents({
        profileId: input.profileId,
        bucket: input.rootContext.bucket,
        thread: createdThread.value,
        session: createdSession.session,
    });

    return {
        accepted: true,
        started: {
            childThreadId: parseEntityId(createdThread.value.id, 'threads.id', 'thr'),
            childSessionId: createdSession.session.id,
            runId: startedRun.runId,
        },
    };
}

export async function abortDelegatedChildRun(profileId: string, childSessionId: EntityId<'sess'>): Promise<void> {
    await runExecutionService.abortRun(profileId, childSessionId);
}

export async function waitForRunTerminal(runId: EntityId<'run'>): Promise<'completed' | 'aborted' | 'error'> {
    for (;;) {
        const run = await runStore.getById(runId);
        if (!run) {
            return 'error';
        }

        if (run.status === 'completed' || run.status === 'aborted' || run.status === 'error') {
            return run.status;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}
