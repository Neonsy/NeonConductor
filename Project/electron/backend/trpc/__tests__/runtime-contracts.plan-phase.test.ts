import { beforeEach, describe, expect, it, vi } from 'vitest';

import { planPhaseStore, runStore } from '@/app/backend/persistence/stores';
import {
    createCaller,
    createSessionInScope,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

import type { PlanRecordView } from '@/shared/contracts';

const mocks = vi.hoisted(() => ({
    runExecutionService: {
        startRun: vi.fn(),
        abortRun: vi.fn(),
    },
    orchestratorExecutionService: {
        start: vi.fn(),
        abort: vi.fn(),
    },
}));

vi.mock('@/app/backend/runtime/services/runExecution/service', () => ({
    runExecutionService: mocks.runExecutionService,
}));

vi.mock('@/app/backend/runtime/services/orchestrator/executionService', () => ({
    orchestratorExecutionService: mocks.orchestratorExecutionService,
}));

registerRuntimeContractHooks();

async function createApprovedAdvancedPlan(
    caller: ReturnType<typeof createCaller>,
    workspaceFingerprint: string
): Promise<PlanRecordView> {
    const created = await createSessionInScope(caller, runtimeContractProfileId, {
        scope: 'workspace',
        workspaceFingerprint,
        title: 'Plan phase router thread',
        kind: 'local',
        topLevelTab: 'agent',
    });

    const started = await caller.plan.start({
        profileId: runtimeContractProfileId,
        sessionId: created.session.id,
        topLevelTab: 'agent',
        modeKey: 'plan',
        prompt: 'Draft an advanced plan and then expand its first detailed phase.',
        planningDepth: 'advanced',
        workspaceFingerprint,
    });

    let activePlan = started.plan;
    for (const question of activePlan.questions.filter((candidate) => candidate.required)) {
        const answered = await caller.plan.answerQuestion({
            profileId: runtimeContractProfileId,
            planId: activePlan.id,
            questionId: question.id,
            answer: `Answer for ${question.id}`,
        });
        if (!answered.found) {
            throw new Error('Expected the clarifying question answer to persist.');
        }
        activePlan = answered.plan;
    }

    const advancedSnapshot = activePlan.advancedSnapshot;
    if (!advancedSnapshot) {
        throw new Error('Expected the advanced plan snapshot to be available.');
    }

    const revisedWithSnapshot = await caller.plan.revise({
        profileId: runtimeContractProfileId,
        planId: activePlan.id,
        summaryMarkdown: '# Phase Router Plan\n\nPrepare the approved roadmap for phase expansion.',
        items: [
            { description: 'Inspect the approved roadmap.' },
            { description: 'Prepare the first detailed phase.' },
        ],
        advancedSnapshot,
    });
    if (!revisedWithSnapshot.found) {
        throw new Error('Expected the plan revision to succeed.');
    }

    const approved = await caller.plan.approve({
        profileId: runtimeContractProfileId,
        planId: activePlan.id,
        revisionId: revisedWithSnapshot.plan.currentRevisionId,
    });
    if (!approved.found) {
        throw new Error('Expected the plan approval to succeed.');
    }

    return approved.plan;
}

async function createImplementingPhase(
    caller: ReturnType<typeof createCaller>,
    workspaceFingerprint: string
): Promise<{
    plan: PlanRecordView;
    phase: NonNullable<PlanRecordView['phases']>[number];
}> {
    const approvedPlan = await createApprovedAdvancedPlan(caller, workspaceFingerprint);

    const expanded = await caller.plan.expandNextPhase({
        profileId: runtimeContractProfileId,
        planId: approvedPlan.id,
    });
    if (!expanded.found) {
        throw new Error('Expected the phase expansion to succeed.');
    }

    const phase = expanded.plan.phases?.[0];
    if (!phase) {
        throw new Error('Expected a detailed phase.');
    }

    const revisedPhase = await caller.plan.revisePhase({
        profileId: runtimeContractProfileId,
        planId: approvedPlan.id,
        phaseId: phase.id,
        phaseRevisionId: phase.currentRevisionId,
        summaryMarkdown: 'Expand the first detailed phase in more detail.',
        items: [
            { description: 'Refine the phase summary.' },
            { description: 'Refine the phase items.' },
        ],
    });
    if (!revisedPhase.found) {
        throw new Error('Expected the phase revision to succeed.');
    }

    const revisedPhaseView = revisedPhase.plan.phases?.[0];
    if (!revisedPhaseView) {
        throw new Error('Expected the revised phase to be present in the plan view.');
    }

    const approvedPhase = await caller.plan.approvePhase({
        profileId: runtimeContractProfileId,
        planId: approvedPlan.id,
        phaseId: phase.id,
        phaseRevisionId: revisedPhaseView.currentRevisionId,
    });
    if (!approvedPhase.found) {
        throw new Error('Expected the phase approval to succeed.');
    }

    const seededRun = await runStore.create({
        profileId: runtimeContractProfileId,
        sessionId: approvedPlan.sessionId,
        planId: approvedPlan.id,
        planRevisionId: approvedPlan.currentRevisionId,
        planPhaseId: phase.id,
        planPhaseRevisionId: revisedPhaseView.currentRevisionId,
        prompt: 'Implement the approved detailed phase for the TRPC test.',
        providerId: 'openai',
        modelId: 'openai/gpt-5',
        authMethod: 'none',
        runtimeOptions: {
            reasoning: {
                effort: 'medium',
                summary: 'auto',
                includeEncrypted: false,
            },
            cache: {
                strategy: 'auto',
            },
            transport: {
                family: 'auto',
            },
        },
        cache: {
            applied: false,
        },
        transport: {
            selected: 'openai_responses',
        },
    });
    mocks.runExecutionService.startRun.mockResolvedValue({
        accepted: true,
        runId: seededRun.id,
    });

    const implementedPhase = await caller.plan.implementPhase({
        profileId: runtimeContractProfileId,
        planId: approvedPlan.id,
        phaseId: phase.id,
        phaseRevisionId: revisedPhaseView.currentRevisionId,
        runtimeOptions: {
            reasoning: {
                effort: 'medium',
                summary: 'auto',
                includeEncrypted: false,
            },
            cache: {
                strategy: 'auto',
            },
            transport: {
                family: 'auto',
            },
        },
    });
    if (!implementedPhase.found) {
        throw new Error('Expected the phase implementation mutation to succeed.');
    }

    const implementedPhaseView = implementedPhase.plan.phases?.[0];
    if (!implementedPhaseView) {
        throw new Error('Expected the implemented phase to be present in the plan view.');
    }

    return {
        plan: implementedPhase.plan,
        phase: implementedPhaseView,
    };
}

async function createImplementedPhase(
    caller: ReturnType<typeof createCaller>,
    workspaceFingerprint: string
): Promise<{
    plan: PlanRecordView;
    phase: NonNullable<PlanRecordView['phases']>[number];
}> {
    const { plan, phase } = await createImplementingPhase(caller, workspaceFingerprint);
    const implementedRevisionId = phase.currentRevisionId;

    const implementedPhase = await planPhaseStore.markPhaseImplemented({
        planId: plan.id,
        planPhaseId: phase.id,
        phaseRevisionId: implementedRevisionId,
    });
    if (!implementedPhase) {
        throw new Error('Expected the phase implementation completion to persist.');
    }

    const refreshedPlan = await caller.plan.get({
        profileId: runtimeContractProfileId,
        planId: plan.id,
    });
    if (!refreshedPlan.found || !refreshedPlan.plan.phases?.[0]) {
        throw new Error('Expected the implemented phase to be available after readback.');
    }

    return {
        plan: refreshedPlan.plan,
        phase: refreshedPlan.plan.phases[0],
    };
}

describe('runtime contracts: plan phases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.runExecutionService.startRun.mockResolvedValue({
            accepted: true,
            runId: 'run_phase_router' as never,
        });
        mocks.runExecutionService.abortRun.mockResolvedValue(undefined);
        mocks.orchestratorExecutionService.start.mockResolvedValue({
            isErr: () => false,
            isOk: () => true,
            value: {
                started: true,
                run: { id: 'orch_phase_router' } as never,
                steps: [] as never,
            },
        } as never);
        mocks.orchestratorExecutionService.abort.mockResolvedValue({
            aborted: true,
            runId: 'orch_phase_router' as never,
            latest: { found: false },
        });
    });

    it('expands, revises, approves, implements, and cancels detailed phases through the router', async () => {
        const caller = createCaller();
        const { plan, phase } = await createImplementingPhase(caller, 'wsf_plan_phase_router');
        expect(plan.planningDepth).toBe('advanced');
        expect(phase.status).toBe('implementing');

        const cancelledPhase = await caller.plan.cancelPhase({
            profileId: runtimeContractProfileId,
            planId: plan.id,
            phaseId: phase.id,
        });
        expect(cancelledPhase.found).toBe(true);
        if (!cancelledPhase.found) {
            throw new Error('Expected the phase cancel mutation to succeed.');
        }
        expect((cancelledPhase.plan.phases ?? [])[0]?.status).toBe('cancelled');
    }, 20000);

    it('records failed verification once and opens a replan draft without rewriting implemented history', async () => {
        const caller = createCaller();
        const { plan, phase } = await createImplementedPhase(caller, 'wsf_plan_phase_verify_failed');

        const implementedRevisionId = phase.implementedRevisionId;
        if (!implementedRevisionId) {
            throw new Error('Expected the implemented phase revision id to be available.');
        }

        const verified = await caller.plan.verifyPhase({
            profileId: runtimeContractProfileId,
            planId: plan.id,
            phaseId: phase.id,
            phaseRevisionId: implementedRevisionId,
            outcome: 'failed',
            summaryMarkdown: 'The implemented phase missed one required verification path.',
            discrepancies: [
                {
                    title: 'Missing validation path',
                    detailsMarkdown: 'The implementation never exercised the fallback validation path.',
                },
            ],
        });
        expect(verified.found).toBe(true);
        if (!verified.found) {
            throw new Error('Expected the phase verification mutation to succeed.');
        }

        const verifiedPhase = verified.plan.phases?.[0];
        if (!verifiedPhase?.latestVerification) {
            throw new Error('Expected the failed verification to be projected on the phase view.');
        }
        expect(verifiedPhase.verificationStatus).toBe('failed');
        expect(verifiedPhase.latestVerification.outcome).toBe('failed');
        expect(verifiedPhase.latestVerification.discrepancies).toHaveLength(1);
        expect(verifiedPhase.canStartReplan).toBe(true);
        expect(verified.plan.history.some((entry) => entry.kind === 'phase_verification_recorded')).toBe(true);

        await expect(
            caller.plan.verifyPhase({
                profileId: runtimeContractProfileId,
                planId: plan.id,
                phaseId: phase.id,
                phaseRevisionId: implementedRevisionId,
                outcome: 'passed',
                summaryMarkdown: 'Trying to verify the same implemented revision twice.',
                discrepancies: [],
            })
        ).rejects.toThrow(/verification/i);

        const replanned = await caller.plan.startPhaseReplan({
            profileId: runtimeContractProfileId,
            planId: plan.id,
            phaseId: phase.id,
            verificationId: verifiedPhase.latestVerification.id,
        });
        expect(replanned.found).toBe(true);
        if (!replanned.found) {
            throw new Error('Expected the phase replan mutation to succeed.');
        }

        const replannedPhase = replanned.plan.phases?.[0];
        if (!replannedPhase) {
            throw new Error('Expected the replanned phase to remain visible on the plan.');
        }
        expect(replannedPhase.status).toBe('draft');
        expect(replannedPhase.currentRevisionNumber).toBeGreaterThan(verifiedPhase.currentRevisionNumber);
        expect(replannedPhase.implementedRevisionId).toBe(implementedRevisionId);
        expect(replannedPhase.latestVerification?.id).toBe(verifiedPhase.latestVerification.id);
        expect(replannedPhase.verifications).toHaveLength(1);
        expect(replanned.plan.history.some((entry) => entry.kind === 'phase_replan_started')).toBe(true);
    });

    it('unlocks the next roadmap phase only after passed verification', async () => {
        const caller = createCaller();
        const { plan, phase } = await createImplementedPhase(caller, 'wsf_plan_phase_verify_passed');

        const implementedRevisionId = phase.implementedRevisionId;
        if (!implementedRevisionId) {
            throw new Error('Expected the implemented phase revision id to be available.');
        }

        const verified = await caller.plan.verifyPhase({
            profileId: runtimeContractProfileId,
            planId: plan.id,
            phaseId: phase.id,
            phaseRevisionId: implementedRevisionId,
            outcome: 'passed',
            summaryMarkdown: 'The implemented phase satisfied its goal and exit criteria.',
            discrepancies: [],
        });
        expect(verified.found).toBe(true);
        if (!verified.found) {
            throw new Error('Expected the passed verification mutation to succeed.');
        }

        const verifiedPhase = verified.plan.phases?.[0];
        expect(verifiedPhase?.verificationStatus).toBe('passed');
        expect(verifiedPhase?.canStartVerification).toBe(false);
        expect(verified.plan.nextExpandablePhaseOutlineId).toBeDefined();

        const expandedNextPhase = await caller.plan.expandNextPhase({
            profileId: runtimeContractProfileId,
            planId: plan.id,
        });
        expect(expandedNextPhase.found).toBe(true);
        if (!expandedNextPhase.found) {
            throw new Error('Expected the second roadmap phase expansion to succeed after verification.');
        }
        expect(expandedNextPhase.plan.phases).toHaveLength(2);
        expect((expandedNextPhase.plan.phases ?? [])[1]?.status).toBe('draft');
    });
});
