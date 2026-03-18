import { describe, expect, it, vi } from 'vitest';

import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';

import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    requireEntityId,
    runtimeContractProfileId,
    waitForOrchestratorStatus,
    waitForRunStatus,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: planning and orchestrator', () => {
    const profileId = runtimeContractProfileId;

    it('enforces planning-only mode and allows switching active mode', async () => {
        const caller = createCaller();

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_mode_enforcement_agent',
            title: 'Mode Enforcement Thread',
            kind: 'local',
            topLevelTab: 'agent',
        });

        const blockedPlanMode = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Should be blocked in plan mode',
            topLevelTab: 'agent',
            modeKey: 'plan',
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(blockedPlanMode.accepted).toBe(false);
        if (blockedPlanMode.accepted) {
            throw new Error('Expected planning-only run start to be rejected.');
        }
        expect(blockedPlanMode.code).toBe('mode_policy_invalid');
        expect(blockedPlanMode.message).toContain('planning-only');
        expect(blockedPlanMode.action).toEqual({
            code: 'mode_invalid',
            modeKey: 'plan',
            topLevelTab: 'agent',
        });

        const setActive = await caller.mode.setActive({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'debug',
        });
        expect(setActive.updated).toBe(true);
        if (!setActive.updated) {
            throw new Error('Expected mode update.');
        }
        expect(setActive.mode.modeKey).toBe('debug');

        const active = await caller.mode.getActive({
            profileId,
            topLevelTab: 'agent',
        });
        expect(active.activeMode.modeKey).toBe('debug');
    });


    it('supports agent planning lifecycle with explicit approve then implement transition', async () => {
        const caller = createCaller();
        const completionFetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => ({
                choices: [
                    {
                        message: {
                            content: 'Plan implementation completed',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 12,
                    completion_tokens: 22,
                    total_tokens: 34,
                },
            }),
        });
        vi.stubGlobal('fetch', completionFetchMock);

        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-plan-test-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_agent_plan_lifecycle',
            title: 'Agent planning lifecycle thread',
            kind: 'local',
            topLevelTab: 'agent',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'plan',
            prompt: 'Build a safe implementation plan for this task.',
        });
        expect(started.plan.status).toBe('awaiting_answers');

        const answeredScope = await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Deliver a minimal deterministic implementation.',
        });
        expect(answeredScope.found).toBe(true);
        if (!answeredScope.found) {
            throw new Error('Expected scope answer update.');
        }

        const answeredConstraints = await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'Keep boundaries explicit and avoid blind casts.',
        });
        expect(answeredConstraints.found).toBe(true);
        if (!answeredConstraints.found) {
            throw new Error('Expected constraints answer update.');
        }
        expect(answeredConstraints.plan.status).toBe('draft');

        const revised = await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Agent Plan\n\n- Implement the approved plan deterministically.',
            items: [
                { description: 'Implement backend contracts first.' },
                { description: 'Implement renderer flow second.' },
            ],
        });
        expect(revised.found).toBe(true);
        if (!revised.found) {
            throw new Error('Expected plan revision.');
        }
        expect(revised.plan.items.length).toBe(2);

        const approved = await caller.plan.approve({
            profileId,
            planId: started.plan.id,
        });
        expect(approved.found).toBe(true);
        if (!approved.found) {
            throw new Error('Expected plan approval.');
        }
        expect(approved.plan.status).toBe('approved');

        const implemented = await caller.plan.implement({
            profileId,
            planId: started.plan.id,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(implemented.found).toBe(true);
        if (!implemented.found) {
            throw new Error('Expected plan implementation start.');
        }
        expect(implemented.mode).toBe('agent.code');
        if (implemented.mode !== 'agent.code') {
            throw new Error('Expected agent.code implementation mode.');
        }

        await waitForRunStatus(caller, profileId, created.session.id, 'completed');

        const planState = await caller.plan.get({
            profileId,
            planId: started.plan.id,
        });
        expect(planState.found).toBe(true);
        if (!planState.found) {
            throw new Error('Expected plan state lookup.');
        }
        expect(planState.plan.status).toBe('implemented');
    });


    it('supports orchestrator sequential execution from approved plan steps', async () => {
        const caller = createCaller();
        const completionFetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => ({
                choices: [
                    {
                        message: {
                            content: 'Orchestrator step completed',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 9,
                    completion_tokens: 15,
                    total_tokens: 24,
                },
            }),
        });
        vi.stubGlobal('fetch', completionFetchMock);

        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-orchestrator-test-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_orchestrator_plan_lifecycle',
            title: 'Orchestrator planning lifecycle thread',
            kind: 'local',
            topLevelTab: 'orchestrator',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'orchestrator',
            modeKey: 'plan',
            prompt: 'Plan a sequential orchestrator execution with two steps.',
        });
        expect(started.plan.status).toBe('awaiting_answers');

        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Execute two deterministic steps in order.',
        });
        const answered = await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'No parallel tasks; fail closed on step errors.',
        });
        expect(answered.found).toBe(true);

        await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Orchestrator Plan\n\nExecute two sequential tasks.',
            items: [{ description: 'Step one task' }, { description: 'Step two task' }],
        });

        const approved = await caller.plan.approve({
            profileId,
            planId: started.plan.id,
        });
        expect(approved.found).toBe(true);

        const implemented = await caller.plan.implement({
            profileId,
            planId: started.plan.id,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(implemented.found).toBe(true);
        if (!implemented.found) {
            throw new Error('Expected orchestrator implementation start.');
        }
        expect(implemented.mode).toBe('orchestrator.orchestrate');
        if (implemented.mode !== 'orchestrator.orchestrate') {
            throw new Error('Expected orchestrator.orchestrate mode.');
        }

        await waitForOrchestratorStatus(caller, profileId, implemented.orchestratorRunId, 'completed');

        const status = await caller.orchestrator.status({
            profileId,
            orchestratorRunId: implemented.orchestratorRunId,
        });
        expect(status.found).toBe(true);
        if (!status.found) {
            throw new Error('Expected orchestrator status to be found.');
        }
        expect(status.run.executionStrategy).toBe('delegate');
        expect(status.steps.length).toBe(2);
        expect(status.steps.every((step) => step.status === 'completed')).toBe(true);
        expect(status.steps.every((step) => step.childThreadId && step.childSessionId && step.runId)).toBe(true);

        const threadList = await caller.conversation.listThreads({
            profileId,
            activeTab: 'orchestrator',
            showAllModes: false,
            groupView: 'workspace',
        });
        const delegatedChildren = threadList.threads.filter((thread) => thread.delegatedFromOrchestratorRunId);
        expect(delegatedChildren).toHaveLength(2);
        expect(delegatedChildren.every((thread) => thread.topLevelTab === 'agent')).toBe(true);

        const sessionList = await caller.session.list({ profileId });
        const delegatedSessions = sessionList.sessions.filter((session) => session.delegatedFromOrchestratorRunId);
        expect(delegatedSessions).toHaveLength(2);
    });

    it('supports parallel orchestrator execution with concurrent delegated child lanes', async () => {
        const caller = createCaller();
        const fetchResolvers: Array<() => void> = [];
        const completionFetchMock = vi.fn().mockImplementation(
            () =>
                new Promise((resolve) => {
                    fetchResolvers.push(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            json: () => ({
                                choices: [
                                    {
                                        message: {
                                            content: 'Parallel child completed',
                                        },
                                    },
                                ],
                                usage: {
                                    prompt_tokens: 8,
                                    completion_tokens: 13,
                                    total_tokens: 21,
                                },
                            }),
                        });
                    });
                })
        );
        vi.stubGlobal('fetch', completionFetchMock);

        await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-parallel-test-key',
        });

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_parallel_orchestrator',
            title: 'Parallel orchestrator lifecycle thread',
            kind: 'local',
            topLevelTab: 'orchestrator',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'orchestrator',
            modeKey: 'plan',
            prompt: 'Plan a parallel orchestrator execution with two steps.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Run both delegated tasks at the same time.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'Parallel child lanes should fail closed.',
        });
        await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Parallel Orchestrator Plan',
            items: [{ description: 'Parallel step one' }, { description: 'Parallel step two' }],
        });
        await caller.plan.approve({
            profileId,
            planId: started.plan.id,
        });

        const implemented = await caller.plan.implement({
            profileId,
            planId: started.plan.id,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            executionStrategy: 'parallel',
        });
        expect(implemented.found).toBe(true);
        if (!implemented.found) {
            throw new Error('Expected parallel orchestrator start.');
        }
        if (implemented.mode !== 'orchestrator.orchestrate') {
            throw new Error('Expected parallel orchestrator mode.');
        }

        for (let attempt = 0; attempt < 40; attempt += 1) {
            const status = await caller.orchestrator.status({
                profileId,
                orchestratorRunId: implemented.orchestratorRunId,
            });
            if (status.found && status.steps.filter((step) => step.status === 'running').length >= 2) {
                expect(status.run.executionStrategy).toBe('parallel');
                expect(status.steps.every((step) => step.childThreadId && step.childSessionId && step.activeRunId)).toBe(
                    true
                );
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 25));
        }

        expect(completionFetchMock).toHaveBeenCalledTimes(2);
        expect(fetchResolvers).toHaveLength(2);

        for (const resolveFetch of fetchResolvers) {
            resolveFetch();
        }

        await waitForOrchestratorStatus(caller, profileId, implemented.orchestratorRunId, 'completed');
    });

    it('rejects delegated child lanes that try to start orchestrator strategies', async () => {
        const caller = createCaller();
        const completionFetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => ({
                choices: [
                    {
                        message: {
                            content: 'Delegated child completed',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 9,
                    completion_tokens: 11,
                    total_tokens: 20,
                },
            }),
        });
        vi.stubGlobal('fetch', completionFetchMock);

        await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-child-orchestrator-test-key',
        });

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_child_orchestrator_guard',
            title: 'Child orchestrator guard thread',
            kind: 'local',
            topLevelTab: 'orchestrator',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'orchestrator',
            modeKey: 'plan',
            prompt: 'Create one delegated worker lane.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Create exactly one worker.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'Keep it deterministic.',
        });
        await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Single child plan',
            items: [{ description: 'Only child step' }],
        });
        await caller.plan.approve({
            profileId,
            planId: started.plan.id,
        });

        const implemented = await caller.plan.implement({
            profileId,
            planId: started.plan.id,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(implemented.found).toBe(true);
        if (!implemented.found) {
            throw new Error('Expected delegated child setup.');
        }
        if (implemented.mode !== 'orchestrator.orchestrate') {
            throw new Error('Expected orchestrator mode for child guard setup.');
        }

        await waitForOrchestratorStatus(caller, profileId, implemented.orchestratorRunId, 'completed');

        const status = await caller.orchestrator.status({
            profileId,
            orchestratorRunId: implemented.orchestratorRunId,
        });
        expect(status.found).toBe(true);
        if (!status.found) {
            throw new Error('Expected orchestrator status for child guard.');
        }

        const childSessionId = requireEntityId(status.steps[0]?.childSessionId, 'sess', 'Expected delegated child session.');
        const childPlan = await caller.plan.start({
            profileId,
            sessionId: childSessionId,
            topLevelTab: 'orchestrator',
            modeKey: 'plan',
            prompt: 'Try to orchestrate from a delegated child lane.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: childPlan.plan.id,
            questionId: 'scope',
            answer: 'Attempt nested delegation.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: childPlan.plan.id,
            questionId: 'constraints',
            answer: 'This should be rejected.',
        });
        await caller.plan.revise({
            profileId,
            planId: childPlan.plan.id,
            summaryMarkdown: '# Nested child orchestrator attempt',
            items: [{ description: 'Nested step' }],
        });
        await caller.plan.approve({
            profileId,
            planId: childPlan.plan.id,
        });

        await expect(
            caller.orchestrator.start({
                profileId,
                planId: childPlan.plan.id,
                runtimeOptions: defaultRuntimeOptions,
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        ).rejects.toThrow(/Delegated worker lanes cannot start orchestrator strategies/);
    });

    it('rolls back delegated child lanes when child run startup is rejected', async () => {
        const caller = createCaller();

        await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-child-start-reject-test-key',
        });

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_child_start_reject_cleanup',
            title: 'Child lane rollback thread',
            kind: 'local',
            topLevelTab: 'orchestrator',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'orchestrator',
            modeKey: 'plan',
            prompt: 'Create one worker lane that will fail to start.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Create one delegated worker.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'Fail closed if the delegated worker cannot start.',
        });
        await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Failed child start plan',
            items: [{ description: 'Delegated child start should reject.' }],
        });
        await caller.plan.approve({
            profileId,
            planId: started.plan.id,
        });

        const startRunSpy = vi.spyOn(runExecutionService, 'startRun').mockResolvedValue({
            accepted: false,
            reason: 'not_found',
        });

        try {
            const implemented = await caller.plan.implement({
                profileId,
                planId: started.plan.id,
                runtimeOptions: defaultRuntimeOptions,
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            });
            expect(implemented.found).toBe(true);
            if (!implemented.found) {
                throw new Error('Expected orchestrator implementation start for rollback test.');
            }
            if (implemented.mode !== 'orchestrator.orchestrate') {
                throw new Error('Expected orchestrator mode for rollback test.');
            }

            await waitForOrchestratorStatus(caller, profileId, implemented.orchestratorRunId, 'failed');

            const status = await caller.orchestrator.status({
                profileId,
                orchestratorRunId: implemented.orchestratorRunId,
            });
            expect(status.found).toBe(true);
            if (!status.found) {
                throw new Error('Expected orchestrator status for rollback test.');
            }
            expect(status.steps[0]?.childThreadId).toBeUndefined();
            expect(status.steps[0]?.childSessionId).toBeUndefined();

            const threadList = await caller.conversation.listThreads({
                profileId,
                activeTab: 'orchestrator',
                showAllModes: false,
                groupView: 'workspace',
            });
            expect(threadList.threads.filter((thread) => thread.delegatedFromOrchestratorRunId)).toHaveLength(0);

            const sessionList = await caller.session.list({ profileId });
            expect(sessionList.sessions.filter((session) => session.delegatedFromOrchestratorRunId)).toHaveLength(0);
        } finally {
            startRunSpy.mockRestore();
        }
    });

});
