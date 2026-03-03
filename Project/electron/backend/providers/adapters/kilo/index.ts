import { syncKiloCatalog } from '@/app/backend/providers/adapters/kilo/catalog';
import { streamKiloRuntime } from '@/app/backend/providers/adapters/kilo/runtime';
import type {
    ProviderAdapter,
    ProviderCatalogSyncResult,
    ProviderRuntimeHandlers,
    ProviderRuntimeInput,
} from '@/app/backend/providers/types';

export class KiloProviderAdapter implements ProviderAdapter {
    readonly id = 'kilo' as const;

    async syncCatalog(input: {
        profileId: string;
        authMethod: 'none' | 'api_key' | 'device_code' | 'oauth_pkce' | 'oauth_device';
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        force?: boolean;
    }): Promise<ProviderCatalogSyncResult> {
        return syncKiloCatalog(input);
    }

    async streamCompletion(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void> {
        await streamKiloRuntime(input, handlers);
    }
}

export const kiloProviderAdapter = new KiloProviderAdapter();
