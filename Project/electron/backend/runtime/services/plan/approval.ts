import { planStore } from '@/app/backend/persistence/stores';
import type { EntityId, PlanRecordView } from '@/app/backend/runtime/contracts';
import { errPlan, okPlan, type PlanServiceError } from '@/app/backend/runtime/services/plan/errors';
import { appendPlanApprovedEvent } from '@/app/backend/runtime/services/plan/events';
import { requirePlanView } from '@/app/backend/runtime/services/plan/views';
import { appLog } from '@/app/main/logging';

import type { Result } from 'neverthrow';

export async function approvePlan(
    profileId: string,
    planId: EntityId<'plan'>
): Promise<Result<{ found: false } | { found: true; plan: PlanRecordView }, PlanServiceError>> {
    const existing = await planStore.getById(profileId, planId);
    if (!existing) {
        return okPlan({ found: false });
    }

    const hasUnanswered = existing.questions.some((question) => {
        const answer = existing.answers[question.id];
        return typeof answer !== 'string' || answer.trim().length === 0;
    });
    if (hasUnanswered) {
        return errPlan('unanswered_questions', 'Cannot approve plan before answering all clarifying questions.');
    }

    const approved = await planStore.approve(planId);
    const items = await planStore.listItems(planId);

    await appendPlanApprovedEvent({
        profileId,
        planId,
    });

    appLog.info({
        tag: 'plan',
        message: 'Approved plan.',
        profileId,
        planId,
    });

    return okPlan({
        found: true,
        plan: requirePlanView(approved, items, 'plan.approve'),
    });
}
