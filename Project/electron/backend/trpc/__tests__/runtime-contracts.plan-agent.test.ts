import { describe, expect, it, vi } from 'vitest';

import { planStore } from '@/app/backend/persistence/stores';
import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
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
        expect(started.plan.currentRevisionNumber).toBe(1);
        expect(started.plan.currentRevisionId).toMatch(/^prev_/);

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
        expect(revised.plan.currentRevisionNumber).toBe(2);
        expect(revised.plan.approvedRevisionId).toBeUndefined();

        const approved = await caller.plan.approve({
            profileId,
            planId: started.plan.id,
            revisionId: revised.plan.currentRevisionId,
        });
        expect(approved.found).toBe(true);
        if (!approved.found) {
            throw new Error('Expected plan approval.');
        }
        expect(approved.plan.status).toBe('approved');
        expect(approved.plan.approvedRevisionId).toBe(revised.plan.currentRevisionId);
        expect(approved.plan.approvedRevisionNumber).toBe(2);

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

    it('keeps immutable revision history, rejects stale approval, and resolves the approved revision snapshot', async () => {
        const caller = createCaller();

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_agent_plan_revisions',
            title: 'Agent planning revisions thread',
            kind: 'local',
            topLevelTab: 'agent',
        });

        const started = await caller.plan.start({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'plan',
            prompt: 'Build a revision-aware implementation plan.',
        });
        expect(started.plan.currentRevisionNumber).toBe(1);

        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'scope',
            answer: 'Capture the first approved revision and then revise it.',
        });
        await caller.plan.answerQuestion({
            profileId,
            planId: started.plan.id,
            questionId: 'constraints',
            answer: 'Preserve immutable history.',
        });

        const firstRevision = await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Revision One',
            items: [{ description: 'Initial item' }],
        });
        expect(firstRevision.found).toBe(true);
        if (!firstRevision.found) {
            throw new Error('Expected first revision.');
        }
        expect(firstRevision.plan.currentRevisionNumber).toBe(2);

        const approved = await caller.plan.approve({
            profileId,
            planId: started.plan.id,
            revisionId: firstRevision.plan.currentRevisionId,
        });
        expect(approved.found).toBe(true);
        if (!approved.found) {
            throw new Error('Expected plan approval.');
        }

        const secondRevision = await caller.plan.revise({
            profileId,
            planId: started.plan.id,
            summaryMarkdown: '# Revision Two',
            items: [{ description: 'Updated item' }, { description: 'Follow-up item' }],
        });
        expect(secondRevision.found).toBe(true);
        if (!secondRevision.found) {
            throw new Error('Expected second revision.');
        }
        expect(secondRevision.plan.currentRevisionNumber).toBe(3);
        expect(secondRevision.plan.approvedRevisionId).toBe(firstRevision.plan.currentRevisionId);
        expect(secondRevision.plan.approvedRevisionNumber).toBe(2);

        await expect(
            caller.plan.approve({
                profileId,
                planId: started.plan.id,
                revisionId: firstRevision.plan.currentRevisionId,
            })
        ).rejects.toThrow(/stale plan revision/i);

        const revisions = await planStore.listRevisions(started.plan.id);
        expect(revisions.map((revision) => revision.revisionNumber)).toEqual([1, 2, 3]);
        expect(revisions[1]?.summaryMarkdown).toBe('# Revision One');
        expect(revisions[1]?.supersededAt).toBeDefined();
        expect(revisions[2]?.summaryMarkdown).toBe('# Revision Two');
        expect(revisions[2]?.supersededAt).toBeUndefined();

        const approvedSnapshot = await planStore.resolveApprovedRevisionSnapshot({
            planId: started.plan.id,
        });
        expect(approvedSnapshot?.revision.id).toBe(firstRevision.plan.currentRevisionId);
        expect(approvedSnapshot?.revision.revisionNumber).toBe(2);
        expect(approvedSnapshot?.items.map((item) => item.description)).toEqual(['Initial item']);
    });
});
