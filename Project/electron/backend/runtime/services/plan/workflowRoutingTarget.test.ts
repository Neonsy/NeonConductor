import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    getWorkflowRoutingPreferencesMock,
    getDefaultsMock,
    getModelCapabilitiesMock,
    listModelsByProfileMock,
} = vi.hoisted(() => ({
    getWorkflowRoutingPreferencesMock: vi.fn(),
    getDefaultsMock: vi.fn(),
    getModelCapabilitiesMock: vi.fn(),
    listModelsByProfileMock: vi.fn(),
}));

const { getWorkspacePreferenceMock } = vi.hoisted(() => ({
    getWorkspacePreferenceMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerStore: {
        getWorkflowRoutingPreferences: getWorkflowRoutingPreferencesMock,
        getDefaults: getDefaultsMock,
        getModelCapabilities: getModelCapabilitiesMock,
        listModelsByProfile: listModelsByProfileMock,
    },
}));

vi.mock('@/app/backend/runtime/services/workspace/preferences', () => ({
    getWorkspacePreference: getWorkspacePreferenceMock,
}));

import { resolvePlanningWorkflowRoutingRunTarget } from '@/app/backend/runtime/services/plan/workflowRoutingTarget';

describe('resolvePlanningWorkflowRoutingRunTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getWorkflowRoutingPreferencesMock.mockResolvedValue([]);
        getDefaultsMock.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        getWorkspacePreferenceMock.mockResolvedValue(undefined);
        getModelCapabilitiesMock.mockResolvedValue({
            features: {
                supportsTools: true,
                supportsReasoning: true,
            },
        });
        listModelsByProfileMock.mockResolvedValue([]);
    });

    it('prefers the advanced planning workflow routing preference when present', async () => {
        getWorkflowRoutingPreferencesMock.mockResolvedValueOnce([
            {
                targetKey: 'planning_advanced',
                providerId: 'moonshot',
                modelId: 'moonshot/kimi-k2.5',
            },
        ]);

        const resolved = await resolvePlanningWorkflowRoutingRunTarget({
            profileId: 'profile_default',
            planningDepth: 'advanced',
            workspaceFingerprint: 'ws_advanced',
        });

        expect(resolved).toEqual({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
            source: 'workflow_routing',
            resolvedTargetKey: 'planning_advanced',
            fellBackToPlanning: false,
        });
    });

    it('falls back from advanced planning to the planning workflow routing target', async () => {
        getWorkflowRoutingPreferencesMock.mockResolvedValueOnce([
            {
                targetKey: 'planning',
                providerId: 'kilo',
                modelId: 'kilo/frontier',
            },
        ]);

        const resolved = await resolvePlanningWorkflowRoutingRunTarget({
            profileId: 'profile_default',
            planningDepth: 'advanced',
            workspaceFingerprint: 'ws_advanced',
        });

        expect(resolved).toEqual({
            providerId: 'kilo',
            modelId: 'kilo/frontier',
            source: 'workflow_routing',
            resolvedTargetKey: 'planning',
            fellBackToPlanning: true,
        });
    });

    it('falls back to the workspace preference when no planning workflow routing preference exists', async () => {
        getWorkspacePreferenceMock.mockResolvedValueOnce({
            profileId: 'profile_default',
            workspaceFingerprint: 'ws_advanced',
            defaultProviderId: 'moonshot',
            defaultModelId: 'moonshot/kimi-k2.5',
            updatedAt: '2026-04-03T10:00:00.000Z',
        });

        const resolved = await resolvePlanningWorkflowRoutingRunTarget({
            profileId: 'profile_default',
            planningDepth: 'simple',
            workspaceFingerprint: 'ws_advanced',
        });

        expect(resolved).toEqual({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
            source: 'workspace_preference',
            resolvedTargetKey: 'planning',
            fellBackToPlanning: false,
        });
    });

    it('uses a compatibility fallback when saved defaults are not planning-compatible', async () => {
        getDefaultsMock.mockResolvedValueOnce({
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        });
        getModelCapabilitiesMock.mockImplementation(async (_profileId: string, _providerId: string, modelId: string) => {
            if (modelId === 'openai/gpt-5-mini') {
                return {
                    features: {
                        supportsTools: true,
                        supportsReasoning: false,
                    },
                };
            }

            return {
                features: {
                    supportsTools: true,
                    supportsReasoning: true,
                },
            };
        });
        listModelsByProfileMock.mockResolvedValueOnce([
            {
                id: 'moonshot/kimi-k2.5',
                providerId: 'moonshot',
                label: 'Kimi K2.5',
                features: {
                    supportsTools: true,
                    supportsReasoning: true,
                    supportsVision: false,
                    supportsAudioInput: false,
                    supportsAudioOutput: false,
                    inputModalities: ['text'],
                    outputModalities: ['text'],
                },
                runtime: {
                    toolProtocol: 'openai_chat_completions',
                    apiFamily: 'openai_compatible',
                },
            },
        ]);

        const resolved = await resolvePlanningWorkflowRoutingRunTarget({
            profileId: 'profile_default',
            planningDepth: 'advanced',
        });

        expect(resolved).toEqual({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
            source: 'compatibility_fallback',
            resolvedTargetKey: 'planning_advanced',
            fellBackToPlanning: false,
        });
    });
});
