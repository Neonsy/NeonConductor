import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactState = vi.hoisted(() => ({
    currentModelPreferenceDrafts: {} as {
        utilityModelDraft?:
            | {
                  profileId: string;
                  providerId?: 'openai';
                  modelId?: string;
              }
            | undefined;
        memoryRetrievalModelDraft?:
            | {
                  profileId: string;
                  providerId?: 'openai';
                  modelId?: string;
              }
            | undefined;
    },
}));

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        useState: () => [
            reactState.currentModelPreferenceDrafts,
            (
                value:
                    | typeof reactState.currentModelPreferenceDrafts
                    | ((current: typeof reactState.currentModelPreferenceDrafts) => typeof reactState.currentModelPreferenceDrafts)
            ) => {
                reactState.currentModelPreferenceDrafts =
                    typeof value === 'function' ? value(reactState.currentModelPreferenceDrafts) : value;
            },
        ],
    };
});

const controllerTestState = vi.hoisted(() => {
    const createCancelMock = () => vi.fn().mockResolvedValue(undefined);
    const createGetDataMock = () => vi.fn();
    const createSetDataMock = () => vi.fn();
    const createMutationResult = () => ({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        error: null,
    });
    type MutationConfig = {
        onMutate?: (...args: any[]) => Promise<any> | any;
        onError?: (...args: any[]) => void;
        onSuccess?: (...args: any[]) => void;
    };

    const mutationConfigs: Record<string, MutationConfig> = {};
    const createUseMutationMock = (name: string) => {
        const result = createMutationResult();
        const useMutation = vi.fn((config: MutationConfig) => {
            mutationConfigs[name] = config;
            return result;
        });

        return {
            useMutation,
            result,
        };
    };

    const utilityQueryData = {
        selection: {
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        },
    };
    const memoryRetrievalQueryData = {
        selection: {
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        },
    };

    return {
        mutationConfigs,
        utilityQueryData,
        memoryRetrievalQueryData,
        utilsMock: {
            conversation: {
                getEditPreference: {
                    cancel: createCancelMock(),
                    getData: createGetDataMock(),
                    setData: createSetDataMock(),
                },
                getThreadTitlePreference: {
                    cancel: createCancelMock(),
                    getData: createGetDataMock(),
                    setData: createSetDataMock(),
                },
            },
            profile: {
                getExecutionPreset: {
                    cancel: createCancelMock(),
                    getData: createGetDataMock(),
                    setData: createSetDataMock(),
                },
                getUtilityModel: {
                    cancel: createCancelMock(),
                    getData: createGetDataMock(),
                    setData: createSetDataMock(),
                },
                getMemoryRetrievalModel: {
                    cancel: createCancelMock(),
                    getData: createGetDataMock(),
                    setData: createSetDataMock(),
                },
            },
            runtime: {
                getShellBootstrap: {
                    setData: createSetDataMock(),
                },
            },
        },
        trpcMocks: {
            conversation: {
                getEditPreference: {
                    useQuery: vi.fn(() => ({
                        data: { value: 'ask' },
                    })),
                },
                setEditPreference: createUseMutationMock('setEditPreference'),
                getThreadTitlePreference: {
                    useQuery: vi.fn(() => ({
                        data: { mode: 'template' },
                    })),
                },
                setThreadTitlePreference: createUseMutationMock('setThreadTitlePreference'),
            },
            profile: {
                getExecutionPreset: {
                    useQuery: vi.fn(() => ({
                        data: { preset: 'standard' },
                    })),
                },
                setExecutionPreset: createUseMutationMock('setExecutionPreset'),
                getUtilityModel: {
                    useQuery: vi.fn(() => ({
                        data: utilityQueryData,
                    })),
                },
                setUtilityModel: createUseMutationMock('setUtilityModel'),
                getMemoryRetrievalModel: {
                    useQuery: vi.fn(() => ({
                        data: memoryRetrievalQueryData,
                    })),
                },
                setMemoryRetrievalModel: createUseMutationMock('setMemoryRetrievalModel'),
            },
            provider: {
                getControlPlane: {
                    useQuery: vi.fn(() => ({
                        data: {
                            providerControl: {
                                providers: [
                                    {
                                        providerId: 'openai',
                                        label: 'OpenAI',
                                        models: [
                                            {
                                                id: 'openai/gpt-5-mini',
                                                label: 'GPT-5 Mini',
                                            },
                                            {
                                                id: 'openai/gpt-5',
                                                label: 'GPT-5',
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    })),
                },
                getEmbeddingControlPlane: {
                    useQuery: vi.fn(() => ({
                        data: {
                            providerEmbeddingControl: {
                                entries: [
                                    {
                                        provider: {
                                            id: 'openai',
                                            label: 'OpenAI',
                                        },
                                        models: [
                                            {
                                                id: 'openai/text-embedding-3-small',
                                                label: 'text-embedding-3-small',
                                                dimensions: 1536,
                                                inputPrice: 0.02,
                                            },
                                            {
                                                id: 'openai/text-embedding-3-large',
                                                label: 'text-embedding-3-large',
                                                dimensions: 3072,
                                                inputPrice: 0.13,
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    })),
                },
            },
        },
    };
});

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        useUtils: () => controllerTestState.utilsMock as never,
        conversation: {
            getEditPreference: controllerTestState.trpcMocks.conversation.getEditPreference,
            setEditPreference: controllerTestState.trpcMocks.conversation.setEditPreference,
            getThreadTitlePreference: controllerTestState.trpcMocks.conversation.getThreadTitlePreference,
            setThreadTitlePreference: controllerTestState.trpcMocks.conversation.setThreadTitlePreference,
        },
        profile: {
            getExecutionPreset: controllerTestState.trpcMocks.profile.getExecutionPreset,
            setExecutionPreset: controllerTestState.trpcMocks.profile.setExecutionPreset,
            getUtilityModel: controllerTestState.trpcMocks.profile.getUtilityModel,
            setUtilityModel: controllerTestState.trpcMocks.profile.setUtilityModel,
            getMemoryRetrievalModel: controllerTestState.trpcMocks.profile.getMemoryRetrievalModel,
            setMemoryRetrievalModel: controllerTestState.trpcMocks.profile.setMemoryRetrievalModel,
        },
        provider: {
            getControlPlane: controllerTestState.trpcMocks.provider.getControlPlane,
            getEmbeddingControlPlane: controllerTestState.trpcMocks.provider.getEmbeddingControlPlane,
        },
    },
}));

vi.mock('@/web/lib/providerControl/selectors', () => ({
    listProviderControlProviders: (providerControl: any) =>
        providerControl.providers.map((provider: any) => ({
            id: provider.providerId,
            label: provider.label,
        })),
    findProviderControlEntry: (providerControl: any, providerId: string | undefined) =>
        providerControl.providers.find((provider: any) => provider.providerId === providerId),
}));

vi.mock('@/web/components/modelSelection/modelCapabilities', () => ({
    buildModelPickerOption: ({ model, provider }: any) => ({
        id: model.id,
        label: model.label,
        providerId: provider?.id,
    }),
}));

import { useProfilePreferencesController } from '@/web/components/settings/profileSettings/useProfilePreferencesController';

let lastController: ReturnType<typeof useProfilePreferencesController> | undefined;

function Harness() {
    lastController = useProfilePreferencesController({
        selection: {
            selectedProfile: {
                id: 'profile_default',
                name: 'Default',
                isActive: true,
                createdAt: '2026-03-31T00:00:00.000Z',
                updatedAt: '2026-03-31T00:00:00.000Z',
            },
            selectedProfileIdForSettings: 'profile_default',
        } as never,
        setStatusMessage: vi.fn(),
    });
    return null;
}

function getMutationConfig(name: keyof typeof controllerTestState.mutationConfigs) {
    return controllerTestState.mutationConfigs[name]!;
}

describe('useProfilePreferencesController', () => {
    beforeEach(() => {
        lastController = undefined;
        reactState.currentModelPreferenceDrafts = {};
        vi.clearAllMocks();
        for (const key of Object.keys(controllerTestState.mutationConfigs)) {
            delete controllerTestState.mutationConfigs[key];
        }
        controllerTestState.utilityQueryData.selection = {
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        };
        controllerTestState.memoryRetrievalQueryData.selection = {
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        };
    });

    it('optimistically updates and rolls back Utility AI selection mutations', async () => {
        renderToStaticMarkup(<Harness />);

        controllerTestState.utilsMock.profile.getUtilityModel.getData.mockReturnValue({
            selection: {
                providerId: 'openai',
                modelId: 'openai/gpt-5-mini',
            },
        });

        const context = await getMutationConfig('setUtilityModel').onMutate?.({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(controllerTestState.utilsMock.profile.getUtilityModel.setData).toHaveBeenCalledWith(
            { profileId: 'profile_default' },
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/gpt-5',
                },
            }
        );

        getMutationConfig('setUtilityModel').onError?.(
            new Error('fail'),
            {
                profileId: 'profile_default',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            },
            context
        );

        expect(controllerTestState.utilsMock.profile.getUtilityModel.setData).toHaveBeenLastCalledWith(
            { profileId: 'profile_default' },
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/gpt-5-mini',
                },
            }
        );
    });

    it('clears local draft state after successful Utility AI save and writes null on clear', async () => {
        renderToStaticMarkup(<Harness />);
        lastController?.setUtilityModelId('openai/gpt-5');
        renderToStaticMarkup(<Harness />);

        await lastController?.saveUtilityModel();

        expect(controllerTestState.trpcMocks.profile.setUtilityModel.result.mutateAsync).toHaveBeenCalledWith({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(reactState.currentModelPreferenceDrafts.utilityModelDraft).toEqual({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        getMutationConfig('setUtilityModel').onSuccess?.(
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/gpt-5',
                },
            },
            {
                profileId: 'profile_default',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            }
        );

        expect(reactState.currentModelPreferenceDrafts.utilityModelDraft).toBeUndefined();
        renderToStaticMarkup(<Harness />);
        expect(lastController?.selectedUtilityModelId).toBe('openai/gpt-5-mini');

        await lastController?.clearUtilityModel();

        expect(controllerTestState.trpcMocks.profile.setUtilityModel.result.mutateAsync).toHaveBeenLastCalledWith({
            profileId: 'profile_default',
        });
        await getMutationConfig('setUtilityModel').onMutate?.({
            profileId: 'profile_default',
        });
        expect(controllerTestState.utilsMock.profile.getUtilityModel.setData).toHaveBeenCalledWith(
            { profileId: 'profile_default' },
            {
                selection: null,
            }
        );
    });

    it('optimistically updates and rolls back Memory Retrieval selection mutations', async () => {
        renderToStaticMarkup(<Harness />);

        controllerTestState.utilsMock.profile.getMemoryRetrievalModel.getData.mockReturnValue({
            selection: {
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-small',
            },
        });

        const context = await getMutationConfig('setMemoryRetrievalModel').onMutate?.({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-large',
        });

        expect(controllerTestState.utilsMock.profile.getMemoryRetrievalModel.setData).toHaveBeenCalledWith(
            { profileId: 'profile_default' },
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/text-embedding-3-large',
                },
            }
        );

        getMutationConfig('setMemoryRetrievalModel').onError?.(
            new Error('fail'),
            {
                profileId: 'profile_default',
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-large',
            },
            context
        );

        expect(controllerTestState.utilsMock.profile.getMemoryRetrievalModel.setData).toHaveBeenLastCalledWith(
            { profileId: 'profile_default' },
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/text-embedding-3-small',
                },
            }
        );
    });

    it('builds Memory Retrieval options from the embedding control plane', () => {
        renderToStaticMarkup(<Harness />);

        expect(lastController?.memoryRetrievalModelOptions.map((option) => option.id)).toEqual([
            'openai/text-embedding-3-small',
            'openai/text-embedding-3-large',
        ]);
        expect(lastController?.selectedMemoryRetrievalModelId).toBe('openai/text-embedding-3-small');
        expect(lastController?.memoryRetrievalModelOptions[0]?.price).toBe(0.02);
    });

    it('clears local Memory Retrieval draft state after successful save and writes null on clear', async () => {
        renderToStaticMarkup(<Harness />);
        lastController?.setMemoryRetrievalModelId('openai/text-embedding-3-large');
        renderToStaticMarkup(<Harness />);

        await lastController?.saveMemoryRetrievalModel();

        expect(controllerTestState.trpcMocks.profile.setMemoryRetrievalModel.result.mutateAsync).toHaveBeenCalledWith({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-large',
        });
        expect(reactState.currentModelPreferenceDrafts.memoryRetrievalModelDraft).toEqual({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-large',
        });

        getMutationConfig('setMemoryRetrievalModel').onSuccess?.(
            {
                selection: {
                    providerId: 'openai',
                    modelId: 'openai/text-embedding-3-large',
                },
            },
            {
                profileId: 'profile_default',
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-large',
            }
        );

        expect(reactState.currentModelPreferenceDrafts.memoryRetrievalModelDraft).toBeUndefined();
        renderToStaticMarkup(<Harness />);
        expect(lastController?.selectedMemoryRetrievalModelId).toBe('openai/text-embedding-3-small');

        await lastController?.clearMemoryRetrievalModel();

        expect(controllerTestState.trpcMocks.profile.setMemoryRetrievalModel.result.mutateAsync).toHaveBeenLastCalledWith({
            profileId: 'profile_default',
        });
        await getMutationConfig('setMemoryRetrievalModel').onMutate?.({
            profileId: 'profile_default',
        });
        expect(controllerTestState.utilsMock.profile.getMemoryRetrievalModel.setData).toHaveBeenCalledWith(
            { profileId: 'profile_default' },
            {
                selection: null,
            }
        );
    });
});
