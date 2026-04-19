import { describe, expect, it } from 'vitest';

import { useConversationComposerTargetState } from '@/web/components/conversation/shell/useConversationComposerTargetState';

import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { ProviderControlSnapshot, ProviderListItem } from '@/app/backend/providers/service/types';

import type { RuntimeShellBootstrap } from '@/shared/contracts';

function createInternalModelRoleDiagnostics(): ProviderControlSnapshot['internalModelRoleDiagnostics'] {
    return {
        roles: [],
        plannerTargets: [],
        updatedAt: '2026-03-21T10:00:00.000Z',
    };
}

function createProvider(input: {
    id: ProviderListItem['id'];
    label: string;
    authMethod: ProviderListItem['authMethod'];
    authState: ProviderListItem['authState'];
}): ProviderListItem {
    return {
        id: input.id,
        label: input.label,
        supportsByok: true,
        isDefault: false,
        authMethod: input.authMethod,
        authState: input.authState,
        availableAuthMethods: input.authMethod === 'none' ? [] : [input.authMethod],
        connectionProfile: {
            providerId: input.id,
            optionProfileId: 'default',
            label: 'Default',
            options: [
                {
                    value: 'default',
                    label: 'Default',
                },
            ],
            resolvedBaseUrl: null,
        },
        apiKeyCta: {
            label: 'Create key',
            url: 'https://example.com',
        },
        features: {
            catalogStrategy: 'dynamic',
            supportsKiloRouting: false,
            supportsModelProviderListing: false,
            supportsConnectionOptions: true,
            supportsCustomBaseUrl: true,
            supportsOrganizationScope: false,
        },
    };
}

function createModel(input: {
    id: string;
    providerId: ProviderModelRecord['providerId'];
    label: string;
    supportsTools?: boolean;
    supportsReasoning?: boolean;
}): ProviderModelRecord {
    return {
        id: input.id,
        providerId: input.providerId,
        label: input.label,
        features: {
            supportsTools: input.supportsTools ?? true,
            supportsReasoning: input.supportsReasoning ?? true,
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
    };
}

function createProviderControl(): ProviderControlSnapshot {
    return {
        entries: [
            {
                provider: createProvider({
                    id: 'openai',
                    label: 'OpenAI',
                    authMethod: 'api_key',
                    authState: 'configured',
                }),
                models: [createModel({ id: 'openai/gpt-5', providerId: 'openai', label: 'GPT-5' })],
                catalogState: {
                    reason: null,
                    invalidModelCount: 0,
                },
            },
            {
                provider: createProvider({
                    id: 'kilo',
                    label: 'Kilo',
                    authMethod: 'device_code',
                    authState: 'authenticated',
                }),
                models: [createModel({ id: 'kilo/frontier', providerId: 'kilo', label: 'Kilo Frontier' })],
                catalogState: {
                    reason: null,
                    invalidModelCount: 0,
                },
            },
        ],
        defaults: {
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        },
        specialistDefaults: [],
        internalModelRoleDiagnostics: createInternalModelRoleDiagnostics(),
    };
}

function createShellBootstrapData(): RuntimeShellBootstrap {
    return {
        lastSequence: 0,
        providerControl: createProviderControl(),
        threadTags: [],
        executionPreset: 'standard',
        workspaceRoots: [],
        workspacePreferences: [
            {
                profileId: 'profile_test',
                workspaceFingerprint: 'ws_selected',
                defaultTopLevelTab: 'chat',
                defaultProviderId: 'openai',
                defaultModelId: 'openai/gpt-5',
                updatedAt: '2026-03-21T10:00:00.000Z',
            },
            {
                profileId: 'profile_test',
                workspaceFingerprint: 'ws_thread',
                defaultTopLevelTab: 'chat',
                defaultProviderId: 'kilo',
                defaultModelId: 'kilo/frontier',
                updatedAt: '2026-03-21T10:00:00.000Z',
            },
        ],
        sandboxes: [],
    };
}

describe('useConversationComposerTargetState', () => {
    it('prefers the selected thread workspace preference over the shell-selected workspace preference', () => {
        const state = useConversationComposerTargetState({
            shellBootstrapData: createShellBootstrapData(),
            selectedWorkspaceFingerprint: 'ws_selected',
            selectedThreadWorkspaceFingerprint: 'ws_thread',
            mainViewDraftTarget: undefined,
            sessionOverride: undefined,
            runs: [],
            activeMode: {
                id: 'mode_chat',
                topLevelTab: 'chat',
                modeKey: 'chat',
                label: 'Chat',
                executionPolicy: {
                    runtimeProfile: 'general',
                },
            },
            modeKey: 'chat',
            isPlanningComposerMode: false,
            planningDepth: 'simple',
            imageAttachmentsAllowed: true,
        });

        expect(state.resolvedRunTarget).toEqual({
            providerId: 'kilo',
            modelId: 'kilo/frontier',
        });
    });

    it('threads planning workflow routing preferences through to the run-target resolver', () => {
        const shellBootstrapData = {
            ...createShellBootstrapData(),
            providerControl: {
                ...createShellBootstrapData().providerControl,
                entries: [
                    ...createShellBootstrapData().providerControl.entries,
                    {
                        provider: createProvider({
                            id: 'moonshot',
                            label: 'Moonshot',
                            authMethod: 'api_key',
                            authState: 'configured',
                        }),
                        models: [
                            createModel({
                                id: 'moonshot/kimi-k2.5',
                                providerId: 'moonshot',
                                label: 'Kimi K2.5',
                                supportsTools: true,
                            }),
                        ],
                        catalogState: {
                            reason: null,
                            invalidModelCount: 0,
                        },
                    },
                ],
                workflowRoutingPreferences: [
                    {
                        targetKey: 'planning_advanced',
                        providerId: 'moonshot',
                        modelId: 'moonshot/kimi-k2.5',
                    },
                ],
            },
        } as RuntimeShellBootstrap & {
            providerControl: RuntimeShellBootstrap['providerControl'] & {
                workflowRoutingPreferences: Array<{
                    targetKey: 'planning' | 'planning_advanced';
                    providerId: string;
                    modelId: string;
                }>;
            };
        };

        const state = useConversationComposerTargetState({
            shellBootstrapData,
            selectedWorkspaceFingerprint: undefined,
            mainViewDraftTarget: undefined,
            sessionOverride: undefined,
            runs: [],
            activeMode: {
                id: 'mode_plan',
                topLevelTab: 'agent',
                modeKey: 'plan',
                label: 'Plan',
                executionPolicy: {
                    runtimeProfile: 'read_only_agent',
                    workflowCapabilities: ['planning'],
                },
            },
            modeKey: 'plan',
            isPlanningComposerMode: true,
            planningDepth: 'advanced',
            imageAttachmentsAllowed: true,
        });

        expect(state.resolvedRunTarget).toEqual({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
        });
        expect(state.resolvedExecutionTarget?.source).toBe('workflow_routing');
        expect(state.resolvedExecutionTarget?.explanation.selectedSourceLabel).toBe('Workflow routing');
    });

    it('uses the simple planning workflow target before a plan starts', () => {
        const shellBootstrapData = {
            ...createShellBootstrapData(),
            providerControl: {
                ...createShellBootstrapData().providerControl,
                workflowRoutingPreferences: [
                    {
                        targetKey: 'planning',
                        providerId: 'kilo',
                        modelId: 'kilo/frontier',
                    },
                ],
            },
        } as RuntimeShellBootstrap & {
            providerControl: RuntimeShellBootstrap['providerControl'] & {
                workflowRoutingPreferences: Array<{
                    targetKey: 'planning' | 'planning_advanced';
                    providerId: string;
                    modelId: string;
                }>;
            };
        };

        const state = useConversationComposerTargetState({
            shellBootstrapData,
            selectedWorkspaceFingerprint: 'ws_selected',
            mainViewDraftTarget: undefined,
            sessionOverride: undefined,
            runs: [],
            activeMode: {
                id: 'mode_plan',
                topLevelTab: 'agent',
                modeKey: 'plan',
                label: 'Plan',
                executionPolicy: {
                    runtimeProfile: 'read_only_agent',
                    workflowCapabilities: ['planning'],
                },
            },
            modeKey: 'plan',
            isPlanningComposerMode: true,
            planningDepth: 'simple',
            imageAttachmentsAllowed: true,
        });

        expect(state.resolvedRunTarget).toEqual({
            providerId: 'kilo',
            modelId: 'kilo/frontier',
        });
        expect(state.resolvedExecutionTarget?.source).toBe('workflow_routing');
    });

    it('switches to the active plan planning depth after upgrade to advanced', () => {
        const shellBootstrapData = {
            ...createShellBootstrapData(),
            providerControl: {
                ...createShellBootstrapData().providerControl,
                entries: [
                    ...createShellBootstrapData().providerControl.entries,
                    {
                        provider: createProvider({
                            id: 'moonshot',
                            label: 'Moonshot',
                            authMethod: 'api_key',
                            authState: 'configured',
                        }),
                        models: [
                            createModel({
                                id: 'moonshot/kimi-k2.5',
                                providerId: 'moonshot',
                                label: 'Kimi K2.5',
                            }),
                        ],
                        catalogState: {
                            reason: null,
                            invalidModelCount: 0,
                        },
                    },
                ],
                workflowRoutingPreferences: [
                    {
                        targetKey: 'planning',
                        providerId: 'kilo',
                        modelId: 'kilo/frontier',
                    },
                    {
                        targetKey: 'planning_advanced',
                        providerId: 'moonshot',
                        modelId: 'moonshot/kimi-k2.5',
                    },
                ],
            },
        } as RuntimeShellBootstrap & {
            providerControl: RuntimeShellBootstrap['providerControl'] & {
                workflowRoutingPreferences: Array<{
                    targetKey: 'planning' | 'planning_advanced';
                    providerId: string;
                    modelId: string;
                }>;
            };
        };

        const state = useConversationComposerTargetState({
            shellBootstrapData,
            selectedWorkspaceFingerprint: undefined,
            mainViewDraftTarget: undefined,
            sessionOverride: undefined,
            runs: [],
            activeMode: {
                id: 'mode_plan',
                topLevelTab: 'agent',
                modeKey: 'plan',
                label: 'Plan',
                executionPolicy: {
                    runtimeProfile: 'read_only_agent',
                    workflowCapabilities: ['planning'],
                },
            },
            modeKey: 'plan',
            isPlanningComposerMode: true,
            planningDepth: 'simple',
            activePlanPlanningDepth: 'advanced',
            imageAttachmentsAllowed: true,
        });

        expect(state.resolvedRunTarget).toEqual({
            providerId: 'moonshot',
            modelId: 'moonshot/kimi-k2.5',
        });
        expect(state.resolvedExecutionTarget?.source).toBe('workflow_routing');
    });
});
