import { planStore } from '@/app/backend/persistence/stores';
import type { PlanEnterAdvancedPlanningInput, PlanRecordView } from '@/app/backend/runtime/contracts';
import { buildAdvancedPlanningSnapshotScaffold } from '@/app/backend/runtime/services/plan/advancedPlanningScaffold';
import { errPlan, okPlan, type PlanServiceError } from '@/app/backend/runtime/services/plan/errors';
import { appendPlanAdvancedPlanningEnteredEvent } from '@/app/backend/runtime/services/plan/events';
import { requirePlanView } from '@/app/backend/runtime/services/plan/views';
import { appLog } from '@/app/main/logging';

import type { Result } from 'neverthrow';

export async function enterAdvancedPlanning(
    input: PlanEnterAdvancedPlanningInput
): Promise<Result<{ found: false } | { found: true; plan: PlanRecordView }, PlanServiceError>> {
    const existing = await planStore.getById(input.profileId, input.planId);
    if (!existing) {
        return okPlan({ found: false });
    }

    if (existing.status === 'implementing') {
        return errPlan('revision_conflict', 'Plan cannot enter advanced planning while implementation is active.');
    }

    if ((existing.planningDepth ?? 'simple') === 'advanced') {
        return errPlan('revision_conflict', 'Plan is already using advanced planning.');
    }

    const items = await planStore.listItems(input.planId);
    const advancedSnapshot = buildAdvancedPlanningSnapshotScaffold({
        sourcePrompt: existing.sourcePrompt,
        questions: existing.questions,
        answers: existing.answers,
        status: existing.status,
        currentRevisionNumber: existing.currentRevisionNumber,
        planningDepth: 'advanced',
        itemDescriptions: items.map((item) => item.description),
        ...(existing.approvedRevisionNumber !== undefined
            ? { approvedRevisionNumber: existing.approvedRevisionNumber }
            : {}),
    });

    const updated = await planStore.enterAdvancedPlanning(input.planId, advancedSnapshot);
    if (!updated || updated.profileId !== input.profileId) {
        return errPlan('revision_conflict', 'Unable to upgrade the plan to advanced planning.');
    }

    await appendPlanAdvancedPlanningEnteredEvent({
        profileId: input.profileId,
        planId: input.planId,
        priorRevisionId: existing.currentRevisionId,
        priorRevisionNumber: existing.currentRevisionNumber,
        revisionId: updated.currentRevisionId,
        revisionNumber: updated.currentRevisionNumber,
        variantId: updated.currentVariantId,
        previousPlanningDepth: existing.planningDepth ?? 'simple',
        planningDepth: 'advanced',
    });

    appLog.info({
        tag: 'plan',
        message: 'Upgraded plan to advanced planning.',
        profileId: input.profileId,
        planId: input.planId,
        priorRevisionId: existing.currentRevisionId,
        revisionId: updated.currentRevisionId,
    });

    const projection = await planStore.getProjectionById(input.profileId, input.planId);
    if (!projection) {
        return errPlan('revision_conflict', 'Unable to read the updated advanced planning state.');
    }

    return okPlan({
        found: true,
        plan: requirePlanView(projection, 'plan.enterAdvancedPlanning'),
    });
}
