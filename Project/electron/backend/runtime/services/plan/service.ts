import { planStore } from '@/app/backend/persistence/stores';
import type {
    EntityId,
    PlanAnswerQuestionInput,
    PlanImplementInput,
    PlanRecordView,
    PlanReviseInput,
    PlanStartInput,
} from '@/app/backend/runtime/contracts';
import { approvePlan } from '@/app/backend/runtime/services/plan/approval';
import { type PlanServiceError, toPlanException } from '@/app/backend/runtime/services/plan/errors';
import { implementApprovedPlan } from '@/app/backend/runtime/services/plan/implementation';
import { answerPlanQuestion, revisePlan } from '@/app/backend/runtime/services/plan/lifecycle';
import { startPlanFlow } from '@/app/backend/runtime/services/plan/start';
import { refreshActivePlanView, refreshPlanViewById } from '@/app/backend/runtime/services/plan/status';
import { appLog } from '@/app/main/logging';

export class PlanService {
    async start(input: PlanStartInput): Promise<{ plan: PlanRecordView }> {
        const result = await startPlanFlow(input);
        if (result.isErr()) {
            appLog.warn({
                tag: 'plan',
                message: 'Rejected plan.start request.',
                profileId: input.profileId,
                sessionId: input.sessionId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                code: result.error.code,
                error: result.error.message,
            });
            throw toPlanException(result.error);
        }

        return result.value;
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
        return answerPlanQuestion(input);
    }

    async revise(input: PlanReviseInput): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        return revisePlan(input);
    }

    async approve(
        profileId: string,
        planId: EntityId<'plan'>
    ): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        const result = await approvePlan(profileId, planId);
        if (result.isErr()) {
            appLog.warn({
                tag: 'plan',
                message: 'Rejected plan.approve request.',
                profileId,
                planId,
                code: result.error.code,
                error: result.error.message,
            });
            throw toPlanException(result.error);
        }

        return result.value;
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
