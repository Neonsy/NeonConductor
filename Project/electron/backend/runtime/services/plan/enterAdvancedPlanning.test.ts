import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    planStore: {
        getById: vi.fn(),
        listItems: vi.fn(),
        enterAdvancedPlanning: vi.fn(),
        getProjectionById: vi.fn(),
    },
    appendPlanAdvancedPlanningEnteredEvent: vi.fn(),
    requirePlanView: vi.fn(),
    infoMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    planStore: mocks.planStore,
}));

vi.mock('@/app/backend/runtime/services/plan/events', () => ({
    appendPlanAdvancedPlanningEnteredEvent: mocks.appendPlanAdvancedPlanningEnteredEvent,
}));

vi.mock('@/app/backend/runtime/services/plan/views', () => ({
    requirePlanView: mocks.requirePlanView,
}));

vi.mock('@/app/main/logging', () => ({
    appLog: {
        info: mocks.infoMock,
    },
}));

import { enterAdvancedPlanning } from '@/app/backend/runtime/services/plan/enterAdvancedPlanning';

describe('enterAdvancedPlanning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.planStore.getById.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'simple',
            status: 'draft',
            sourcePrompt: 'Upgrade the planning lane.',
            summaryMarkdown: '# Plan',
            questions: [
                {
                    id: 'scope',
                    question: 'What exact deliverable should this plan produce first?',
                    category: 'deliverable',
                    required: true,
                },
            ],
            answers: {
                scope: 'Ship the richer intake flow.',
            },
            currentRevisionId: 'prev_1',
            currentRevisionNumber: 1,
            currentVariantId: 'pvar_1',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
        });
        mocks.planStore.listItems.mockResolvedValue([
            {
                id: 'step_1',
                planId: 'plan_1',
                sequence: 1,
                description: 'Inspect the current plan intake controller.',
                status: 'pending',
                createdAt: '2026-04-02T10:00:00.000Z',
                updatedAt: '2026-04-02T10:00:00.000Z',
            },
            {
                id: 'step_2',
                planId: 'plan_1',
                sequence: 2,
                description: 'Seed the advanced planning scaffold.',
                status: 'pending',
                createdAt: '2026-04-02T10:00:00.000Z',
                updatedAt: '2026-04-02T10:00:00.000Z',
            },
        ]);
        mocks.planStore.enterAdvancedPlanning.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Upgrade the planning lane.',
            summaryMarkdown: '# Plan',
            questions: [],
            answers: {},
            currentRevisionId: 'prev_2',
            currentRevisionNumber: 2,
            currentVariantId: 'pvar_1',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:05:00.000Z',
        });
        mocks.planStore.getProjectionById.mockResolvedValue({ projection: 'plan' });
        mocks.requirePlanView.mockReturnValue({ id: 'plan_1' });
        mocks.appendPlanAdvancedPlanningEnteredEvent.mockResolvedValue(undefined);
    });

    it('upgrades a simple plan into advanced planning and seeds a snapshot scaffold', async () => {
        const result = await enterAdvancedPlanning({
            profileId: 'profile_default',
            planId: 'plan_1',
        });

        expect(result.isOk()).toBe(true);
        expect(mocks.planStore.enterAdvancedPlanning).toHaveBeenCalledWith(
            'plan_1',
            expect.objectContaining({
                evidenceMarkdown: expect.stringContaining('Source Prompt'),
                observationsMarkdown: expect.stringContaining('Observations'),
                rootCauseMarkdown: expect.stringContaining('Root Cause'),
                phases: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'phase_1',
                        sequence: 1,
                    }),
                ]),
            })
        );
        expect(mocks.appendPlanAdvancedPlanningEnteredEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: 'plan_1',
                previousPlanningDepth: 'simple',
                planningDepth: 'advanced',
                priorRevisionId: 'prev_1',
                revisionId: 'prev_2',
            })
        );
    });

    it('rejects plans that are already advanced', async () => {
        mocks.planStore.getById.mockResolvedValueOnce({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Upgrade the planning lane.',
            summaryMarkdown: '# Plan',
            questions: [],
            answers: {},
            currentRevisionId: 'prev_1',
            currentRevisionNumber: 1,
            currentVariantId: 'pvar_1',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
        });

        const result = await enterAdvancedPlanning({
            profileId: 'profile_default',
            planId: 'plan_1',
        });

        expect(result.isErr()).toBe(true);
        expect(mocks.planStore.enterAdvancedPlanning).not.toHaveBeenCalled();
    });
});
