import { beforeEach, vi } from 'vitest';

const { resolveProviderNativeRuntimeSpecializationMock, resolveProviderRuntimePathContextMock } = vi.hoisted(() => ({
    resolveProviderNativeRuntimeSpecializationMock: vi.fn(),
    resolveProviderRuntimePathContextMock: vi.fn(),
}));

vi.mock('@/app/backend/providers/adapters/providerNative', () => ({
    resolveProviderNativeRuntimeSpecialization: resolveProviderNativeRuntimeSpecializationMock,
}));

vi.mock('@/app/backend/providers/runtimePathContext', () => ({
    resolveProviderRuntimePathContext: resolveProviderRuntimePathContextMock,
}));

export type ResolveRuntimeProtocolInput = Parameters<
    (typeof import('@/app/backend/runtime/services/runExecution/protocol'))['resolveRuntimeProtocol']
>[0];

export const protocolTestProfileId = 'profile_local_default';

export function createProtocolRuntimeOptions(): ResolveRuntimeProtocolInput['runtimeOptions'] {
    return {
        reasoning: {
            effort: 'none',
            summary: 'none',
            includeEncrypted: false,
        },
        cache: {
            strategy: 'auto',
        },
        transport: {
            family: 'auto',
        },
    };
}

export async function resolveRuntimeProtocolForTest(input: ResolveRuntimeProtocolInput) {
    const { resolveRuntimeProtocol } = await import('@/app/backend/runtime/services/runExecution/protocol');
    return resolveRuntimeProtocol(input);
}

beforeEach(() => {
    resolveProviderNativeRuntimeSpecializationMock.mockReset();
    resolveProviderRuntimePathContextMock.mockReset();
    resolveProviderRuntimePathContextMock.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: {
            profileId: protocolTestProfileId,
            providerId: 'openai',
            optionProfileId: 'default',
            resolvedBaseUrl: 'https://api.anthropic.com/v1',
        },
    });
});

export { resolveProviderNativeRuntimeSpecializationMock, resolveProviderRuntimePathContextMock };
