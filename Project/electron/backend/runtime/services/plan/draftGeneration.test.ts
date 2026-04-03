import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    getByIdMock,
    reviseMock,
    listItemsMock,
    getProjectionByIdMock,
    getActiveResearchBatchByRevisionMock,
    resolveSummaryGenerationTargetMock,
    generatePlainTextFromMessagesMock,
    appendPlanDraftGenerationStartedEventMock,
    appendPlanRevisedEventMock,
    appendPlanDraftGeneratedEventMock,
    resolvePlanningWorkflowRoutingRunTargetMock,
    infoMock,
} = vi.hoisted(() => ({
    getByIdMock: vi.fn(),
    reviseMock: vi.fn(),
    listItemsMock: vi.fn(),
    getProjectionByIdMock: vi.fn(),
    getActiveResearchBatchByRevisionMock: vi.fn(),
    resolveSummaryGenerationTargetMock: vi.fn(),
    generatePlainTextFromMessagesMock: vi.fn(),
    appendPlanDraftGenerationStartedEventMock: vi.fn(),
    appendPlanRevisedEventMock: vi.fn(),
    appendPlanDraftGeneratedEventMock: vi.fn(),
    resolvePlanningWorkflowRoutingRunTargetMock: vi.fn(),
    infoMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    planStore: {
        getById: getByIdMock,
        revise: reviseMock,
        listItems: listItemsMock,
        getProjectionById: getProjectionByIdMock,
        getActiveResearchBatchByRevision: getActiveResearchBatchByRevisionMock,
    },
}));

vi.mock('@/app/backend/runtime/services/common/summaryGenerationTarget', () => ({
    resolveSummaryGenerationTarget: resolveSummaryGenerationTargetMock,
}));

vi.mock('@/app/backend/runtime/services/common/plainTextGeneration', () => ({
    generatePlainTextFromMessages: generatePlainTextFromMessagesMock,
}));

vi.mock('@/app/backend/runtime/services/plan/workflowRoutingTarget', () => ({
    resolvePlanningWorkflowRoutingRunTarget: resolvePlanningWorkflowRoutingRunTargetMock,
}));

vi.mock('@/app/backend/runtime/services/plan/events', () => ({
    appendPlanDraftGenerationStartedEvent: appendPlanDraftGenerationStartedEventMock,
    appendPlanRevisedEvent: appendPlanRevisedEventMock,
    appendPlanDraftGeneratedEvent: appendPlanDraftGeneratedEventMock,
}));

vi.mock('@/app/main/logging', () => ({
    appLog: {
        info: infoMock,
    },
}));

import { generatePlanDraft } from '@/app/backend/runtime/services/plan/draftGeneration';

describe('generatePlanDraft', () => {
    beforeEach(() => {
        getByIdMock.mockReset();
        reviseMock.mockReset();
        listItemsMock.mockReset();
        getProjectionByIdMock.mockReset();
        getActiveResearchBatchByRevisionMock.mockReset();
        resolveSummaryGenerationTargetMock.mockReset();
        generatePlainTextFromMessagesMock.mockReset();
        appendPlanDraftGenerationStartedEventMock.mockReset();
        appendPlanRevisedEventMock.mockReset();
        appendPlanDraftGeneratedEventMock.mockReset();
        resolvePlanningWorkflowRoutingRunTargetMock.mockReset();
        infoMock.mockReset();
        getActiveResearchBatchByRevisionMock.mockResolvedValue(null);
    });

    function buildProjection(
        plan: Record<string, unknown>,
        items: Array<Record<string, unknown>> = [
            {
                id: 'step_1',
                planId: 'plan_1',
                sequence: 1,
                description: 'Inspect the current plan intake controller.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
            {
                id: 'step_2',
                planId: 'plan_1',
                sequence: 2,
                description: 'Implement the richer intake and draft-generation path.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
            {
                id: 'step_3',
                planId: 'plan_1',
                sequence: 3,
                description: 'Verify the plan UI and runtime contracts.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
        ]
    ) {
        return {
            plan,
            items,
            variants: [
                {
                    id: 'pvar_1',
                    planId: 'plan_1',
                    name: 'main',
                    createdAt: '2026-04-02T10:00:00.000Z',
                },
            ],
            followUps: [],
            researchBatches: [],
            researchWorkers: [],
            evidenceAttachments: [],
            phases: [],
            phaseRevisions: [],
            phaseRevisionItems: [],
            phaseVerifications: [],
            phaseVerificationDiscrepancies: [],
            history: [],
            recoveryBanner: undefined,
        };
    }

    it('persists a model-assisted draft revision when structured generation succeeds', async () => {
        getByIdMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            status: 'draft',
            sourcePrompt: 'Draft a revision-aware implementation plan.',
            summaryMarkdown: '# Plan',
            questions: [
                {
                    id: 'scope',
                    question: 'What exact deliverable should this plan produce first?',
                    category: 'deliverable',
                    required: true,
                },
                {
                    id: 'constraints',
                    question: 'Which constraints are non-negotiable for implementation?',
                    category: 'constraints',
                    required: true,
                },
            ],
            answers: {
                scope: 'Ship the richer intake flow.',
                constraints: 'Keep immutable revisions and exact approval semantics intact.',
            },
            currentRevisionId: 'prev_1',
            currentRevisionNumber: 1,
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
        });
        resolveSummaryGenerationTargetMock.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });
        generatePlainTextFromMessagesMock.mockResolvedValue({
            isErr: () => false,
            value: JSON.stringify({
                summaryMarkdown: '# Model Draft\n\n## Goal\n\nShip the richer intake flow.',
                items: [
                    'Inspect the current plan intake controller.',
                    'Implement the richer intake and draft-generation path.',
                    'Verify the plan UI and runtime contracts.',
                ],
            }),
        });
        reviseMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            status: 'draft',
            sourcePrompt: 'Draft a revision-aware implementation plan.',
            summaryMarkdown: '# Model Draft\n\n## Goal\n\nShip the richer intake flow.',
            questions: [
                {
                    id: 'scope',
                    question: 'What exact deliverable should this plan produce first?',
                    category: 'deliverable',
                    required: true,
                },
                {
                    id: 'constraints',
                    question: 'Which constraints are non-negotiable for implementation?',
                    category: 'constraints',
                    required: true,
                },
            ],
            answers: {
                scope: 'Ship the richer intake flow.',
                constraints: 'Keep immutable revisions and exact approval semantics intact.',
            },
            currentRevisionId: 'prev_2',
            currentRevisionNumber: 2,
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:05:00.000Z',
        });
        getProjectionByIdMock.mockResolvedValue(
            buildProjection({
                id: 'plan_1',
                profileId: 'profile_default',
                sessionId: 'sess_1',
                topLevelTab: 'agent',
                modeKey: 'plan',
                status: 'draft',
                sourcePrompt: 'Draft a revision-aware implementation plan.',
                summaryMarkdown: '# Model Draft\n\n## Goal\n\nShip the richer intake flow.',
                questions: [
                    {
                        id: 'scope',
                        question: 'What exact deliverable should this plan produce first?',
                        category: 'deliverable',
                        required: true,
                    },
                    {
                        id: 'constraints',
                        question: 'Which constraints are non-negotiable for implementation?',
                        category: 'constraints',
                        required: true,
                    },
                ],
                answers: {
                    scope: 'Ship the richer intake flow.',
                    constraints: 'Keep immutable revisions and exact approval semantics intact.',
                },
                currentRevisionId: 'prev_2',
                currentRevisionNumber: 2,
                currentVariantId: 'pvar_1',
                createdAt: '2026-04-02T10:00:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            })
        );
        listItemsMock.mockResolvedValue([
            {
                id: 'step_1',
                planId: 'plan_1',
                sequence: 1,
                description: 'Inspect the current plan intake controller.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
            {
                id: 'step_2',
                planId: 'plan_1',
                sequence: 2,
                description: 'Implement the richer intake and draft-generation path.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
            {
                id: 'step_3',
                planId: 'plan_1',
                sequence: 3,
                description: 'Verify the plan UI and runtime contracts.',
                status: 'pending',
                createdAt: '2026-04-02T10:05:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
            },
        ]);

        const result = await generatePlanDraft({
            profileId: 'profile_default',
            planId: 'plan_1',
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
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            workspaceFingerprint: 'ws_1',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error('Expected model-assisted draft generation to succeed.');
        }
        expect(result.value).toEqual({
            found: true,
            plan: expect.objectContaining({
                id: 'plan_1',
                currentRevisionId: 'prev_2',
                currentRevisionNumber: 2,
                summaryMarkdown: '# Model Draft\n\n## Goal\n\nShip the richer intake flow.',
            }),
        });
        if (!result.value.found) {
            throw new Error('Expected a found plan view.');
        }
        expect(result.value.plan.items.map((item) => item.description)).toEqual([
            'Inspect the current plan intake controller.',
            'Implement the richer intake and draft-generation path.',
            'Verify the plan UI and runtime contracts.',
        ]);
        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                profileId: 'profile_default',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        );
        expect(appendPlanDraftGeneratedEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: 'plan_1',
                generationMode: 'model',
                revisionId: 'prev_2',
                revisionNumber: 2,
            })
        );
    });

    it('preserves an existing advanced planning snapshot when generating a draft', async () => {
        const advancedSnapshot = {
            evidenceMarkdown: 'evidence',
            observationsMarkdown: 'observations',
            rootCauseMarkdown: 'root cause',
            phases: [
                {
                    id: 'phase_1',
                    sequence: 1,
                    title: 'Scope and evidence',
                    goalMarkdown: 'goal',
                    exitCriteriaMarkdown: 'exit',
                },
            ],
            createdAt: '2026-04-02T10:00:00.000Z',
        };

        getByIdMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Draft an advanced planning lane.',
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
            advancedSnapshot,
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
        });
        resolveSummaryGenerationTargetMock.mockResolvedValue(null);
        resolvePlanningWorkflowRoutingRunTargetMock.mockResolvedValue(null);
        generatePlainTextFromMessagesMock.mockReset();
        listItemsMock.mockResolvedValue([]);
        reviseMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Draft an advanced planning lane.',
            summaryMarkdown: '# Model Draft',
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
            currentRevisionId: 'prev_2',
            currentRevisionNumber: 2,
            currentVariantId: 'pvar_1',
            advancedSnapshot,
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:05:00.000Z',
        });
        getProjectionByIdMock.mockResolvedValue(
            buildProjection(
                {
                id: 'plan_1',
                profileId: 'profile_default',
                sessionId: 'sess_1',
                topLevelTab: 'agent',
                modeKey: 'plan',
                planningDepth: 'advanced',
                status: 'draft',
                sourcePrompt: 'Draft an advanced planning lane.',
                summaryMarkdown: '# Model Draft',
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
                currentRevisionId: 'prev_2',
                currentRevisionNumber: 2,
                currentVariantId: 'pvar_1',
                advancedSnapshot,
                createdAt: '2026-04-02T10:00:00.000Z',
                updatedAt: '2026-04-02T10:05:00.000Z',
                },
                []
            )
        );

        const result = await generatePlanDraft({
            profileId: 'profile_default',
            planId: 'plan_1',
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
            workspaceFingerprint: 'ws_1',
        });

        expect(result.isOk()).toBe(true);
        expect(reviseMock).toHaveBeenCalledWith(
            'plan_1',
            expect.stringContaining('# Plan'),
            expect.arrayContaining([
                'Inspect the relevant code paths and existing constraints.',
                'Deliver the agreed outcome: Ship the richer intake flow.',
                'Verify the result against the agreed constraints and expected outcome.',
            ]),
            expect.objectContaining({
                advancedSnapshot,
            })
        );
    });

    it('uses workflow routing defaults for model-assisted planning when provider and model are omitted', async () => {
        getByIdMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Generate an advanced plan draft.',
            summaryMarkdown: '# Plan',
            questions: [],
            answers: {},
            currentRevisionId: 'prev_1',
            currentRevisionNumber: 1,
            currentVariantId: 'pvar_1',
            workspaceFingerprint: 'ws_advanced',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
        });
        resolvePlanningWorkflowRoutingRunTargetMock.mockResolvedValue({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
            source: 'workflow_routing',
            resolvedTargetKey: 'planning_advanced',
            fellBackToPlanning: false,
        });
        resolveSummaryGenerationTargetMock.mockResolvedValue({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
            source: 'fallback',
        });
        generatePlainTextFromMessagesMock.mockResolvedValue({
            isErr: () => false,
            value: JSON.stringify({
                summaryMarkdown: '# Workflow Routed Draft',
                items: ['Inspect the current planning depth state.'],
            }),
        });
        reviseMock.mockResolvedValue({
            id: 'plan_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            status: 'draft',
            sourcePrompt: 'Generate an advanced plan draft.',
            summaryMarkdown: '# Workflow Routed Draft',
            questions: [],
            answers: {},
            currentRevisionId: 'prev_2',
            currentRevisionNumber: 2,
            currentVariantId: 'pvar_1',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:05:00.000Z',
        });
        getProjectionByIdMock.mockResolvedValue(
            buildProjection(
                {
                    id: 'plan_1',
                    profileId: 'profile_default',
                    sessionId: 'sess_1',
                    topLevelTab: 'agent',
                    modeKey: 'plan',
                    planningDepth: 'advanced',
                    status: 'draft',
                    sourcePrompt: 'Generate an advanced plan draft.',
                    summaryMarkdown: '# Workflow Routed Draft',
                    questions: [],
                    answers: {},
                    currentRevisionId: 'prev_2',
                    currentRevisionNumber: 2,
                    currentVariantId: 'pvar_1',
                    createdAt: '2026-04-02T10:00:00.000Z',
                    updatedAt: '2026-04-02T10:05:00.000Z',
                },
                [
                    {
                        id: 'step_1',
                        planId: 'plan_1',
                        sequence: 1,
                        description: 'Inspect the current planning depth state.',
                        status: 'pending',
                        createdAt: '2026-04-02T10:05:00.000Z',
                        updatedAt: '2026-04-02T10:05:00.000Z',
                    },
                ]
            )
        );

        const result = await generatePlanDraft({
            profileId: 'profile_default',
            planId: 'plan_1',
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
            workspaceFingerprint: 'ws_advanced',
        });

        expect(result.isOk()).toBe(true);
        expect(resolvePlanningWorkflowRoutingRunTargetMock).toHaveBeenCalledWith({
            profileId: 'profile_default',
            planningDepth: 'advanced',
            workspaceFingerprint: 'ws_advanced',
        });
        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                providerId: 'moonshot',
                modelId: 'moonshot/kimi-k2.5',
            })
        );
    });
});
