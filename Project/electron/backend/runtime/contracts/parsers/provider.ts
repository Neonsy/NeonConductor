import {
    createParser,
    readOptionalBoolean,
    readOptionalString,
    readProfileId,
    readProviderAuthMethod,
    readProviderId,
    readObject,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import { parseProfileInput } from '@/app/backend/runtime/contracts/parsers/profile';
import type {
    ProviderByIdInput,
    ProviderCancelAuthInput,
    ProviderClearAuthInput,
    ProviderCompleteAuthInput,
    ProviderGetAccountContextInput,
    ProviderListAuthMethodsInput,
    ProviderListModelsInput,
    ProviderListProvidersInput,
    ProviderPollAuthInput,
    ProviderRefreshAuthInput,
    ProviderSetApiKeyInput,
    ProviderSetDefaultInput,
    ProviderSetOrganizationInput,
    ProviderStartAuthInput,
    ProviderSyncCatalogInput,
    ProviderFlowInput,
} from '@/app/backend/runtime/contracts/types';

export function parseProviderSetDefaultInput(input: unknown): ProviderSetDefaultInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        modelId: readString(source.modelId, 'modelId'),
    };
}

export function parseProviderListProvidersInput(input: unknown): ProviderListProvidersInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
    };
}

export function parseProviderByIdInput(input: unknown): ProviderByIdInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
    };
}

export function parseProviderListModelsInput(input: unknown): ProviderListModelsInput {
    return parseProviderByIdInput(input);
}

export function parseProviderSetApiKeyInput(input: unknown): ProviderSetApiKeyInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        apiKey: readString(source.apiKey, 'apiKey'),
    };
}

export function parseProviderClearAuthInput(input: unknown): ProviderClearAuthInput {
    return parseProviderByIdInput(input);
}

export function parseProviderSyncCatalogInput(input: unknown): ProviderSyncCatalogInput {
    const source = readObject(input, 'input');
    const force = readOptionalBoolean(source.force, 'force');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        ...(force !== undefined ? { force } : {}),
    };
}

export function parseProviderListAuthMethodsInput(input: unknown): ProviderListAuthMethodsInput {
    return parseProfileInput(input);
}

export function parseProviderStartAuthInput(input: unknown): ProviderStartAuthInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        method: readProviderAuthMethod(source.method, 'method'),
    };
}

export function parseProviderFlowInput(input: unknown): ProviderFlowInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        flowId: readString(source.flowId, 'flowId'),
    };
}

export function parseProviderPollAuthInput(input: unknown): ProviderPollAuthInput {
    return parseProviderFlowInput(input);
}

export function parseProviderCompleteAuthInput(input: unknown): ProviderCompleteAuthInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        flowId: readString(source.flowId, 'flowId'),
        ...(source.code !== undefined ? { code: readString(source.code, 'code') } : {}),
    };
}

export function parseProviderCancelAuthInput(input: unknown): ProviderCancelAuthInput {
    return parseProviderFlowInput(input);
}

export function parseProviderRefreshAuthInput(input: unknown): ProviderRefreshAuthInput {
    return parseProviderByIdInput(input);
}

export function parseProviderGetAccountContextInput(input: unknown): ProviderGetAccountContextInput {
    return parseProviderByIdInput(input);
}

export function parseProviderSetOrganizationInput(input: unknown): ProviderSetOrganizationInput {
    const source = readObject(input, 'input');
    const providerId = readProviderId(source.providerId, 'providerId');
    if (providerId !== 'kilo') {
        throw new Error('Invalid "providerId": organization selection is supported only for "kilo".');
    }

    const organizationId =
        source.organizationId === null ? null : readOptionalString(source.organizationId, 'organizationId');

    return {
        profileId: readProfileId(source),
        providerId,
        ...(organizationId !== undefined ? { organizationId } : {}),
    };
}

export const providerSetDefaultInputSchema = createParser(parseProviderSetDefaultInput);
export const providerListProvidersInputSchema = createParser(parseProviderListProvidersInput);
export const providerListModelsInputSchema = createParser(parseProviderListModelsInput);
export const providerByIdInputSchema = createParser(parseProviderByIdInput);
export const providerSetApiKeyInputSchema = createParser(parseProviderSetApiKeyInput);
export const providerClearAuthInputSchema = createParser(parseProviderClearAuthInput);
export const providerSyncCatalogInputSchema = createParser(parseProviderSyncCatalogInput);
export const providerListAuthMethodsInputSchema = createParser(parseProviderListAuthMethodsInput);
export const providerStartAuthInputSchema = createParser(parseProviderStartAuthInput);
export const providerPollAuthInputSchema = createParser(parseProviderPollAuthInput);
export const providerCompleteAuthInputSchema = createParser(parseProviderCompleteAuthInput);
export const providerCancelAuthInputSchema = createParser(parseProviderCancelAuthInput);
export const providerRefreshAuthInputSchema = createParser(parseProviderRefreshAuthInput);
export const providerGetAccountContextInputSchema = createParser(parseProviderGetAccountContextInput);
export const providerSetOrganizationInputSchema = createParser(parseProviderSetOrganizationInput);
