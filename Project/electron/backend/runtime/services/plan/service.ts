import { planStore } from '@/app/backend/persistence/stores';
import type {
    EntityId,
    PlanAnswerQuestionInput,
    PlanImplementInput,
    PlanRecordView,
    PlanReviseInput,
    PlanStartInput,
} from '@/app/backend/runtime/contracts';
import {
    type PlanServiceError,
    toPlanException,
    validatePlanStartInput,
} from '@/app/backend/runtime/services/plan/errors';
import { implementApprovedPlan } from '@/app/backend/runtime/services/plan/implementation';
import { refreshActivePlanView, refreshPlanViewById } from '@/app/backend/runtime/services/plan/status';
import { createDefaultQuestions, requirePlanView } from '@/app/backend/runtime/services/plan/views';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

export class PlanService {
    async start(input: PlanStartInput): Promise<{ plan: PlanRecordView }> {
        const validation = validatePlanStartInput(input);
        if (validation.isErr()) {
            appLog.warn({
                tag: 'plan',
                message: 'Rejected plan.start request.',
                profileId: input.profileId,
                sessionId: input.sessionId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                code: validation.error.code,
                error: validation.error.message,
            });
            throw toPlanException(validation.error);
        }

        const questions = createDefaultQuestions(input.prompt);
        const summaryMarkdown = `# Plan\n\n${input.prompt.trim()}`;
        const plan = await planStore.create({
            profileId: input.profileId,
            sessionId: input.sessionId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            sourcePrompt: input.prompt.trim(),
            summaryMarkdown,
            questions,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'plan',
            domain: 'plan',
            entityId: plan.id,
            eventType: 'plan.started',
            payload: {
                profileId: input.profileId,
                sessionId: input.sessionId,
                topLevelTab: input.topLevelTab,
                planId: plan.id,
            },
            })
        );

        for (const question of questions) {
            await runtimeEventLogService.append(
                runtimeStatusEvent({
                entityType: 'plan',
                domain: 'plan',
                entityId: plan.id,
                eventType: 'plan.question.requested',
                payload: {
                    planId: plan.id,
                    questionId: question.id,
                    question: question.question,
                },
                })
            );
        }

        appLog.info({
            tag: 'plan',
            message: 'Started planning flow.',
            profileId: input.profileId,
            sessionId: input.sessionId,
            planId: plan.id,
            topLevelTab: input.topLevelTab,
        });

        return {
            plan: requirePlanView(plan, [], 'plan.start'),
        };
    }

    async getById(
        profileId: string,
        planId: EntityId<'plan'>
    ): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        return refreshPlanViewById({
            profileId,
            planId,
        });
    }

    async getActiveBySession(input: {
        profileId: string;
        sessionId: EntityId<'sess'>;
        topLevelTab: 'chat' | 'agent' | 'orchestrator';
    }): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        return refreshActivePlanView(input);
    }

    async answerQuestion(
        input: PlanAnswerQuestionInput
    ): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        const updated = await planStore.setAnswer(input.planId, input.questionId, input.answer);
        if (!updated || updated.profileId !== input.profileId) {
            return { found: false };
        }

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'plan',
            domain: 'plan',
            entityId: input.planId,
            eventType: 'plan.question.answered',
            payload: {
                planId: input.planId,
                questionId: input.questionId,
            },
            })
        );

        const items = await planStore.listItems(input.planId);
        return {
            found: true,
            plan: requirePlanView(updated, items, 'plan.answerQuestion'),
        };
    }

    async revise(input: PlanReviseInput): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
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

    async approve(
        profileId: string,
        planId: EntityId<'plan'>
    ): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        const existing = await planStore.getById(profileId, planId);
        if (!existing) {
            return { found: false };
        }

        const hasUnanswered = existing.questions.some((question) => {
            const answer = existing.answers[question.id];
            return typeof answer !== 'string' || answer.trim().length === 0;
        });
        if (hasUnanswered) {
            const validation: PlanServiceError = {
                code: 'unanswered_questions',
                message: 'Cannot approve plan before answering all clarifying questions.',
            };
            appLog.warn({
                tag: 'plan',
                message: 'Rejected plan.approve request.',
                profileId,
                planId,
                code: validation.code,
                error: validation.message,
            });
            throw toPlanException(validation);
        }

        const approved = await planStore.approve(planId);
        const items = await planStore.listItems(planId);

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'plan',
            domain: 'plan',
            entityId: planId,
            eventType: 'plan.approved',
            payload: {
                planId,
                profileId,
            },
            })
        );

        appLog.info({
            tag: 'plan',
            message: 'Approved plan.',
            profileId,
            planId,
        });

        return {
            found: true,
            plan: requirePlanView(approved, items, 'plan.approve'),
        };
    }

    async implement(input: PlanImplementInput): Promise<
        | { found: false }
        | { found: true; started: true; mode: 'agent.code'; runId: EntityId<'run'>; plan: PlanRecordView }
        | {
              found: true;
              started: true;
              mode: 'orchestrator.orchestrate';
              orchestratorRunId: EntityId<'orch'>;
              plan: PlanRecordView;
          }
    > {
        const plan = await planStore.getById(input.profileId, input.planId);
        if (!plan) {
            return { found: false };
        }
        if (plan.status !== 'approved' && plan.status !== 'implementing') {
            const validation: PlanServiceError = {
                code: 'not_approved',
                message: 'Plan must be approved before implementation.',
            };
            appLog.warn({
                tag: 'plan',
                message: 'Rejected plan.implement request.',
                profileId: input.profileId,
                planId: input.planId,
                code: validation.code,
                error: validation.message,
            });
            throw toPlanException(validation);
        }
        const implementation = await implementApprovedPlan({
            profileId: input.profileId,
            plan,
            implementationInput: input,
        });
        if ('code' in implementation) {
            appLog.warn({
                tag: 'plan',
                message: 'Rejected unsupported or failed plan implementation request.',
                profileId: input.profileId,
                planId: input.planId,
                code: implementation.code,
                error: implementation.message,
                topLevelTab: plan.topLevelTab,
            });
            throw toPlanException(implementation);
        }

        return {
            found: true,
            ...implementation,
        };
    }
}

export const planService = new PlanService();
