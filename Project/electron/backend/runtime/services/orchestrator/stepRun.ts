import { runStore } from '@/app/backend/persistence/stores';
import type { OrchestratorStepRecord, PlanRecord } from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';

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

export function startOrchestratorStepRun(input: {
    plan: PlanRecord;
    step: OrchestratorStepRecord;
    startInput: OrchestratorStartInput;
}) {
    return runExecutionService.startRun({
        profileId: input.startInput.profileId,
        sessionId: input.plan.sessionId,
        prompt: buildStepPrompt(input.plan, input.step),
        topLevelTab: 'orchestrator',
        modeKey: 'orchestrate',
        runtimeOptions: input.startInput.runtimeOptions,
        ...(input.startInput.providerId ? { providerId: input.startInput.providerId } : {}),
        ...(input.startInput.modelId ? { modelId: input.startInput.modelId } : {}),
        ...(input.startInput.workspaceFingerprint
            ? { workspaceFingerprint: input.startInput.workspaceFingerprint }
            : {}),
    });
}
