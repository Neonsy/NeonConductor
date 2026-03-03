import { providerAuthStore } from '@/app/backend/persistence/stores';
import { readSecretValue } from '@/app/backend/providers/auth/secretRefs';
import type { ResolvedRunAuth } from '@/app/backend/runtime/services/runExecution/types';

function isOauthMethod(method: string): method is 'device_code' | 'oauth_pkce' | 'oauth_device' {
    return method === 'device_code' || method === 'oauth_pkce' || method === 'oauth_device';
}

export async function resolveRunAuth(input: {
    profileId: string;
    providerId: 'kilo' | 'openai';
}): Promise<ResolvedRunAuth> {
    const state = await providerAuthStore.getByProfileAndProvider(input.profileId, input.providerId);
    if (!state || state.authMethod === 'none' || state.authState === 'logged_out') {
        throw new Error(`Provider "${input.providerId}" is not authenticated/configured.`);
    }

    if (state.authMethod === 'api_key') {
        if (state.authState !== 'configured' && state.authState !== 'authenticated') {
            throw new Error(
                `Provider "${input.providerId}" auth state "${state.authState}" is not runnable for API key mode.`
            );
        }

        const apiKey = await readSecretValue(input.profileId, input.providerId, 'api_key');
        if (!apiKey) {
            throw new Error(`Provider "${input.providerId}" API key is missing from secret store.`);
        }

        return {
            authMethod: state.authMethod,
            apiKey,
            ...(state.organizationId ? { organizationId: state.organizationId } : {}),
        };
    }

    if (isOauthMethod(state.authMethod)) {
        if (state.authState !== 'authenticated') {
            throw new Error(
                `Provider "${input.providerId}" auth state "${state.authState}" is not runnable for OAuth/device mode.`
            );
        }

        const accessToken = await readSecretValue(input.profileId, input.providerId, 'access_token');
        if (!accessToken) {
            throw new Error(`Provider "${input.providerId}" access token is missing from secret store.`);
        }

        return {
            authMethod: state.authMethod,
            accessToken,
            ...(state.organizationId ? { organizationId: state.organizationId } : {}),
        };
    }

    throw new Error(`Provider "${input.providerId}" auth method is not supported for runtime.`);
}
