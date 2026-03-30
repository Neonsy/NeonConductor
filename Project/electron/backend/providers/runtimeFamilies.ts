import { runtimeProtocolSelectionDefinitions } from '@/app/backend/providers/runtimeProtocolSelectionPolicy';
import type {
    ResolveRuntimeFamilyInput,
    ResolvedRuntimeFamilyProtocol,
    RuntimeFamilyCatalogInput,
    RuntimeFamilyDefinition,
    RuntimeFamilyExecutionPath,
} from '@/app/backend/providers/runtimeFamilyPolicy.types';
import type { ProviderToolProtocol } from '@/app/backend/providers/types';
import { errRunExecution, type RunExecutionResult } from '@/app/backend/runtime/services/runExecution/errors';

const runtimeFamilyDefinitions: Record<ProviderToolProtocol, RuntimeFamilyDefinition> = runtimeProtocolSelectionDefinitions;

export type {
    ResolveRuntimeFamilyInput,
    ResolvedRuntimeFamilyProtocol,
    RuntimeFamilyCatalogInput,
    RuntimeFamilyDefinition,
    RuntimeFamilyExecutionPath,
} from '@/app/backend/providers/runtimeFamilyPolicy.types';

export function getRuntimeFamilyDefinition(toolProtocol: ProviderToolProtocol): RuntimeFamilyDefinition {
    return runtimeFamilyDefinitions[toolProtocol];
}

export function resolveRuntimeFamilyExecutionPath(toolProtocol: ProviderToolProtocol): RuntimeFamilyExecutionPath {
    return getRuntimeFamilyDefinition(toolProtocol).executionPath;
}

export function supportsCatalogRuntimeFamily(input: RuntimeFamilyCatalogInput): boolean {
    const runtime = input.model.runtime;
    if (!runtime) {
        return false;
    }

    const toolProtocol = runtime.toolProtocol;
    const definition = runtimeFamilyDefinitions[toolProtocol];
    if (!definition) {
        return false;
    }

    return definition.supportsCatalogModel(input);
}

export async function resolveRuntimeFamilyProtocol(
    input: ResolveRuntimeFamilyInput
): Promise<RunExecutionResult<ResolvedRuntimeFamilyProtocol>> {
    if (!input.modelCapabilities.runtime) {
        return errRunExecution(
            'runtime_option_invalid',
            `Model "${input.modelId}" is missing runtime protocol metadata.`
        );
    }

    const toolProtocol = input.modelCapabilities.runtime.toolProtocol;
    const definition = runtimeFamilyDefinitions[toolProtocol];
    if (!definition) {
        return errRunExecution(
            'runtime_option_invalid',
            `Model "${input.modelId}" references unsupported runtime protocol "${toolProtocol}".`
        );
    }

    return definition.resolveProtocol(input);
}
