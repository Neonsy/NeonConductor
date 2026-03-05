import { err, ok, type Result } from 'neverthrow';

import { planStore, runStore } from '@/app/backend/persistence/stores';
import type { PlanQuestionRecord } from '@/app/backend/persistence/types';
import type {
    EntityId,
    PlanAnswerQuestionInput,
    PlanImplementInput,
    PlanRecordView,
    PlanReviseInput,
    PlanStartInput,
} from '@/app/backend/runtime/contracts';
import { orchestratorExecutionService } from '@/app/backend/runtime/services/orchestrator/executionService';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

type PlanServiceErrorCode =
    | 'invalid_mode'
    | 'invalid_tab'
    | 'unanswered_questions'
    | 'not_approved'
    | 'run_start_failed'
    | 'unsupported_tab';

interface PlanServiceError {
    code: PlanServiceErrorCode;
    message: string;
}

class PlanServiceException extends Error {
    readonly code: PlanServiceErrorCode;

    constructor(error: PlanServiceError) {
        super(error.message);
        this.name = 'PlanServiceException';
        this.code = error.code;
    }
}

function okPlan<T>(value: T): Result<T, PlanServiceError> {
    return ok(value);
}

function errPlan(code: PlanServiceErrorCode, message: string): Result<never, PlanServiceError> {
    return err({
        code,
        message,
    });
}

function toPlanException(error: PlanServiceError): Error {
    return new PlanServiceException(error);
}

function validatePlanStartInput(input: PlanStartInput): Result<void, PlanServiceError> {
    if (input.modeKey !== 'plan') {
        return errPlan('invalid_mode', `Plan flow only supports "plan" mode, received "${input.modeKey}".`);
    }
    if (input.topLevelTab === 'chat') {
        return errPlan('invalid_tab', 'Planning flow is only available in agent or orchestrator tabs.');
    }

    return okPlan(undefined);
}

function createDefaultQuestions(prompt: string): PlanQuestionRecord[] {
    const normalized = prompt.trim();
    if (normalized.length === 0) {
        return [];
    }

    return [
        {
            id: 'scope',
            question: 'What exact output should this plan produce first?',
        },
        {
            id: 'constraints',
            question: 'Which constraints are non-negotiable for implementation?',
        },
    ];
}

function toPlanView(
    plan: Awaited<ReturnType<typeof planStore.getById>>,
    items: Awaited<ReturnType<typeof planStore.listItems>>
): PlanRecordView | null {
    if (!plan) {
        return null;
    }

    return {
        id: plan.id,
        profileId: plan.profileId,
        sessionId: plan.sessionId,
        topLevelTab: plan.topLevelTab,
        modeKey: plan.modeKey,
        status: plan.status,
        sourcePrompt: plan.sourcePrompt,
        summaryMarkdown: plan.summaryMarkdown,
        questions: plan.questions.map((question) => ({
            id: question.id,
            question: question.question,
            ...(plan.answers[question.id] ? { answer: plan.answers[question.id] } : {}),
        })),
        items: items.map((item) => ({
            id: item.id,
            sequence: item.sequence,
            description: item.description,
            status: item.status,
            ...(item.runId ? { runId: item.runId } : {}),
            ...(item.errorMessage ? { errorMessage: item.errorMessage } : {}),
        })),
        ...(plan.workspaceFingerprint ? { workspaceFingerprint: plan.workspaceFingerprint } : {}),
        ...(plan.implementationRunId ? { implementationRunId: plan.implementationRunId } : {}),
        ...(plan.orchestratorRunId ? { orchestratorRunId: plan.orchestratorRunId } : {}),
        ...(plan.approvedAt ? { approvedAt: plan.approvedAt } : {}),
        ...(plan.implementedAt ? { implementedAt: plan.implementedAt } : {}),
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}

function requirePlanView(
    plan: Awaited<ReturnType<typeof planStore.getById>>,
    items: Awaited<ReturnType<typeof planStore.listItems>>,
    context: string
): PlanRecordView {
    const view = toPlanView(plan, items);
    if (!view) {
        throw new Error(`Invariant violation: expected plan view during ${context}.`);
    }

    return view;
}

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

        await runtimeEventLogService.append({
            entityType: 'plan',
            entityId: plan.id,
            eventType: 'plan.started',
            payload: {
                profileId: input.profileId,
                sessionId: input.sessionId,
                topLevelTab: input.topLevelTab,
                planId: plan.id,
            },
        });

        for (const question of questions) {
            await runtimeEventLogService.append({
                entityType: 'plan',
                entityId: plan.id,
                eventType: 'plan.question.requested',
                payload: {
                    planId: plan.id,
                    questionId: question.id,
                    question: question.question,
                },
            });
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
        const plan = await planStore.getById(profileId, planId);
        if (!plan) {
            return { found: false };
        }

        if (plan.status === 'implementing' && plan.implementationRunId) {
            const run = await runStore.getById(plan.implementationRunId);
            if (run?.status === 'completed') {
                await planStore.markImplemented(plan.id);
            } else if (run?.status === 'aborted' || run?.status === 'error') {
                await planStore.markFailed(plan.id);
            }
        }

        const refreshed = await planStore.getById(profileId, planId);
        const items = await planStore.listItems(planId);
        const view = toPlanView(refreshed, items);
        if (!view) {
            return { found: false };
        }

        return {
            found: true,
            plan: view,
        };
    }

    async getActiveBySession(input: {
        profileId: string;
        sessionId: EntityId<'sess'>;
        topLevelTab: 'chat' | 'agent' | 'orchestrator';
    }): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        const plan = await planStore.getLatestBySession(input.profileId, input.sessionId, input.topLevelTab);
        if (!plan) {
            return { found: false };
        }

        if (plan.status === 'implementing' && plan.implementationRunId) {
            const run = await runStore.getById(plan.implementationRunId);
            if (run?.status === 'completed') {
                await planStore.markImplemented(plan.id);
            } else if (run?.status === 'aborted' || run?.status === 'error') {
                await planStore.markFailed(plan.id);
            }
        }

        const refreshed = await planStore.getById(input.profileId, plan.id);
        const items = await planStore.listItems(plan.id);
        const view = toPlanView(refreshed, items);
        if (!view) {
            return { found: false };
        }

        return { found: true, plan: view };
    }

    async answerQuestion(
        input: PlanAnswerQuestionInput
    ): Promise<{ found: false } | { found: true; plan: PlanRecordView }> {
        const updated = await planStore.setAnswer(input.planId, input.questionId, input.answer);
        if (!updated || updated.profileId !== input.profileId) {
            return { found: false };
        }

        await runtimeEventLogService.append({
            entityType: 'plan',
            entityId: input.planId,
            eventType: 'plan.question.answered',
            payload: {
                planId: input.planId,
                questionId: input.questionId,
            },
        });

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

        await runtimeEventLogService.append({
            entityType: 'plan',
            entityId: planId,
            eventType: 'plan.approved',
            payload: {
                planId,
                profileId,
            },
        });

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

        if (plan.topLevelTab === 'agent') {
            const items = await planStore.listItems(plan.id);
            const taskList = items.map((item) => `- ${item.description}`).join('\n');
            const implementationPrompt = [
                'Implement the approved plan.',
                '',
                'Plan summary:',
                plan.summaryMarkdown,
                '',
                'Plan steps:',
                taskList.length > 0 ? taskList : '- No explicit steps were provided.',
            ].join('\n');

            const result = await runExecutionService.startRun({
                profileId: input.profileId,
                sessionId: plan.sessionId,
                prompt: implementationPrompt,
                topLevelTab: 'agent',
                modeKey: 'code',
                runtimeOptions: input.runtimeOptions,
                ...(input.providerId ? { providerId: input.providerId } : {}),
                ...(input.modelId ? { modelId: input.modelId } : {}),
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            });

            if (!result.accepted) {
                const failure: PlanServiceError = {
                    code: 'run_start_failed',
                    message: `Plan implementation failed to start: ${result.reason}.`,
                };
                appLog.warn({
                    tag: 'plan',
                    message: 'Failed to start implementation run for approved plan.',
                    profileId: input.profileId,
                    planId: plan.id,
                    code: failure.code,
                    error: failure.message,
                    reason: result.reason,
                });
                throw toPlanException(failure);
            }

            const implementing = await planStore.markImplementing(plan.id, result.runId);
            await runtimeEventLogService.append({
                entityType: 'plan',
                entityId: plan.id,
                eventType: 'plan.implementation.started',
                payload: {
                    planId: plan.id,
                    profileId: input.profileId,
                    mode: 'agent.code',
                    runId: result.runId,
                },
            });

            appLog.info({
                tag: 'plan',
                message: 'Started agent implementation run from approved plan.',
                profileId: input.profileId,
                planId: plan.id,
                runId: result.runId,
            });

            return {
                found: true,
                started: true,
                mode: 'agent.code',
                runId: result.runId,
                plan: requirePlanView(implementing, items, 'plan.implement.agent'),
            };
        }

        if (plan.topLevelTab === 'orchestrator') {
            const started = await orchestratorExecutionService.start({
                profileId: input.profileId,
                planId: input.planId,
                runtimeOptions: input.runtimeOptions,
                ...(input.providerId ? { providerId: input.providerId } : {}),
                ...(input.modelId ? { modelId: input.modelId } : {}),
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            });
            const implementing = await planStore.markImplementing(plan.id, undefined, started.run.id);
            const items = await planStore.listItems(plan.id);

            await runtimeEventLogService.append({
                entityType: 'plan',
                entityId: plan.id,
                eventType: 'plan.implementation.started',
                payload: {
                    planId: plan.id,
                    profileId: input.profileId,
                    mode: 'orchestrator.orchestrate',
                    orchestratorRunId: started.run.id,
                },
            });

            appLog.info({
                tag: 'plan',
                message: 'Started orchestrator implementation run from approved plan.',
                profileId: input.profileId,
                planId: plan.id,
                orchestratorRunId: started.run.id,
            });

            return {
                found: true,
                started: true,
                mode: 'orchestrator.orchestrate',
                orchestratorRunId: started.run.id,
                plan: requirePlanView(implementing, items, 'plan.implement.orchestrator'),
            };
        }

        const unsupported: PlanServiceError = {
            code: 'unsupported_tab',
            message: 'Chat plans cannot be implemented through plan.implement.',
        };
        appLog.warn({
            tag: 'plan',
            message: 'Rejected unsupported plan implementation tab.',
            profileId: input.profileId,
            planId: input.planId,
            code: unsupported.code,
            error: unsupported.message,
            topLevelTab: plan.topLevelTab,
        });
        throw toPlanException(unsupported);
    }
}

export const planService = new PlanService();
