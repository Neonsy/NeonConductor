import { planStore } from '@/app/backend/persistence/stores';
import type { PlanAnswerQuestionInput, PlanRecordView, PlanReviseInput } from '@/app/backend/runtime/contracts';
import { appendPlanQuestionAnsweredEvent } from '@/app/backend/runtime/services/plan/events';
import { requirePlanView } from '@/app/backend/runtime/services/plan/views';

export async function answerPlanQuestion(
    input: PlanAnswerQuestionInput
): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
    const updated = await planStore.setAnswer(input.planId, input.questionId, input.answer);
    if (!updated || updated.profileId !== input.profileId) {
        return { found: false };
    }

    await appendPlanQuestionAnsweredEvent({
        planId: input.planId,
        questionId: input.questionId,
    });

    const items = await planStore.listItems(input.planId);
    return {
        found: true,
        plan: requirePlanView(updated, items, 'plan.answerQuestion'),
    };
}

export async function revisePlan(
    input: PlanReviseInput
): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
    const revised = await planStore.revise(input.planId, input.summaryMarkdown);
    if (!revised || revised.profileId !== input.profileId) {
        return { found: false };
    }

    const descriptions = input.items
        .map((item) => item.description.trim())
        .filter((description) => description.length > 0);
    const items = await planStore.replaceItems(input.planId, descriptions);

    return {
        found: true,
        plan: requirePlanView(revised, items, 'plan.revise'),
    };
}
