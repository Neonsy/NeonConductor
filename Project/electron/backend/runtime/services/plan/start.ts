import { planStore } from '@/app/backend/persistence/stores';
import type { PlanRecordView, PlanStartInput } from '@/app/backend/runtime/contracts';
import { buildAdvancedPlanningSnapshotScaffold } from '@/app/backend/runtime/services/plan/advancedPlanningScaffold';
import {
    errPlan,
    type PlanServiceError,
    okPlan,
    validatePlanStartInput,
} from '@/app/backend/runtime/services/plan/errors';
import { appendPlanQuestionRequestedEvents, appendPlanStartedEvent } from '@/app/backend/runtime/services/plan/events';
import { createInitialPlanSummary, createPlanIntakeQuestions } from '@/app/backend/runtime/services/plan/intake';
import { requirePlanView } from '@/app/backend/runtime/services/plan/views';
import { resolveModesForTab } from '@/app/backend/runtime/services/registry/service';
import { appLog } from '@/app/main/logging';

import type { Result } from 'neverthrow';

export async function startPlanFlow(
    input: PlanStartInput
): Promise<Result<{ plan: PlanRecordView }, PlanServiceError>> {
    const modes = await resolveModesForTab({
        profileId: input.profileId,
        topLevelTab: input.topLevelTab,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    const mode = modes.find((candidate) => candidate.modeKey === input.modeKey) ?? null;

    const validation = validatePlanStartInput(input, mode);
    if (validation.isErr()) {
        return errPlan(validation.error.code, validation.error.message);
    }

    const questions = createPlanIntakeQuestions({
        prompt: input.prompt,
        topLevelTab: input.topLevelTab,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    const planningDepth = input.planningDepth ?? 'simple';
    const advancedSnapshot =
        planningDepth === 'advanced'
            ? buildAdvancedPlanningSnapshotScaffold({
                  sourcePrompt: input.prompt,
                  questions,
                  answers: {},
                  status: questions.length > 0 ? 'awaiting_answers' : 'draft',
                  currentRevisionNumber: 1,
                  planningDepth,
                  itemDescriptions: [],
              })
            : undefined;
    const plan = await planStore.create({
        profileId: input.profileId,
        sessionId: input.sessionId,
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        planningDepth,
        sourcePrompt: input.prompt.trim(),
        summaryMarkdown: createInitialPlanSummary({
            prompt: input.prompt,
            questions,
        }),
        questions,
        ...(advancedSnapshot ? { advancedSnapshot } : {}),
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });

    await appendPlanStartedEvent({
        profileId: input.profileId,
        sessionId: input.sessionId,
        topLevelTab: input.topLevelTab,
        planId: plan.id,
        revisionId: plan.currentRevisionId,
        revisionNumber: plan.currentRevisionNumber,
        variantId: plan.currentVariantId,
        planningDepth,
    });
    await appendPlanQuestionRequestedEvents({
        planId: plan.id,
        questions,
    });

    appLog.info({
        tag: 'plan',
        message: 'Started planning flow.',
        profileId: input.profileId,
        sessionId: input.sessionId,
        planId: plan.id,
        topLevelTab: input.topLevelTab,
    });

    const projection = await planStore.getProjectionById(input.profileId, plan.id);
    return okPlan({
        plan: requirePlanView(projection, 'plan.start'),
    });
}
