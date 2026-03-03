import { kiloCatalogBehavior } from '@/app/backend/providers/behaviors/kilo/catalog';
import { kiloRuntimeBehavior } from '@/app/backend/providers/behaviors/kilo/runtime';
import { openAICatalogBehavior } from '@/app/backend/providers/behaviors/openai/catalog';
import { openAIRuntimeBehavior } from '@/app/backend/providers/behaviors/openai/runtime';
import type { ProviderCatalogBehavior, ProviderRuntimeBehavior } from '@/app/backend/providers/behaviors/types';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import type { FirstPartyProviderId } from '@/app/backend/providers/registry';

const runtimeBehaviorRegistry: Record<FirstPartyProviderId, ProviderRuntimeBehavior> = {
    kilo: kiloRuntimeBehavior,
    openai: openAIRuntimeBehavior,
};

const catalogBehaviorRegistry: Record<FirstPartyProviderId, ProviderCatalogBehavior> = {
    kilo: kiloCatalogBehavior,
    openai: openAICatalogBehavior,
};

export function getProviderRuntimeBehavior(providerId: string): ProviderRuntimeBehavior {
    const supportedProviderId = assertSupportedProviderId(providerId);
    return runtimeBehaviorRegistry[supportedProviderId];
}

export function getProviderCatalogBehavior(providerId: string): ProviderCatalogBehavior {
    const supportedProviderId = assertSupportedProviderId(providerId);
    return catalogBehaviorRegistry[supportedProviderId];
}
