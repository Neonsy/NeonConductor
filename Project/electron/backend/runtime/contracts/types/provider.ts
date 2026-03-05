import type { ProviderAuthMethod, RuntimeProviderId } from '@/app/backend/runtime/contracts/enums';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface MarketplacePackage {
    id: string;
    packageKind: string;
    slug: string;
    version: string;
    enabled: boolean;
    pinned: boolean;
    source: Record<string, unknown>;
    installedAt: string;
    updatedAt: string;
    assets: Array<{
        assetKind: string;
        assetId: string;
        createdAt: string;
    }>;
}

export interface KiloAccountContext {
    profileId: string;
    accountId?: string;
    displayName: string;
    emailMasked: string;
    authState: string;
    tokenExpiresAt?: string;
    organizations: Array<{
        id: string;
        organizationId: string;
        name: string;
        isActive: boolean;
        entitlement: Record<string, unknown>;
    }>;
    updatedAt: string;
}

export interface ProviderSetDefaultInput extends ProfileInput {
    providerId: RuntimeProviderId;
    modelId: string;
}

export type ProviderListProvidersInput = ProfileInput;

export interface ProviderByIdInput extends ProfileInput {
    providerId: RuntimeProviderId;
}

export type ProviderListModelsInput = ProviderByIdInput;

export interface ProviderSetApiKeyInput extends ProviderByIdInput {
    apiKey: string;
}

export type ProviderClearAuthInput = ProviderByIdInput;

export interface ProviderSyncCatalogInput extends ProviderByIdInput {
    force?: boolean;
}

export type ProviderListAuthMethodsInput = ProfileInput;

export interface ProviderStartAuthInput extends ProfileInput {
    providerId: RuntimeProviderId;
    method: ProviderAuthMethod;
}

export interface ProviderFlowInput extends ProviderByIdInput {
    flowId: string;
}

export type ProviderPollAuthInput = ProviderFlowInput;

export interface ProviderCompleteAuthInput extends ProviderFlowInput {
    code?: string;
}

export type ProviderCancelAuthInput = ProviderFlowInput;

export type ProviderRefreshAuthInput = ProviderByIdInput;

export type ProviderGetAccountContextInput = ProviderByIdInput;

export interface ProviderSetOrganizationInput extends ProfileInput {
    providerId: 'kilo';
    organizationId?: string | null;
}

export interface SecretReference {
    id: string;
    profileId: string;
    providerId: RuntimeProviderId;
    secretKeyRef: string;
    secretKind: string;
    status: string;
    updatedAt: string;
}
