import type { ProviderAuthStateRecord } from '@/app/backend/persistence/types';
import {
    getAccountContext,
    setOrganization as setOrganizationContext,
} from '@/app/backend/providers/auth/authAccountContextService';
import {
    clearAuth,
    ensureProviderExists,
    getAuthState,
    setApiKey,
    persistAuthenticatedState,
} from '@/app/backend/providers/auth/authStateService';
import { AUTH_METHODS_BY_PROVIDER } from '@/app/backend/providers/auth/constants';
import { toAuthExecutionException } from '@/app/backend/providers/auth/errors';
import { refreshOpenAIToken } from '@/app/backend/providers/auth/openaiOAuthClient';
import { cancelAuthFlow, completeAuthFlow, pollAuthFlow } from '@/app/backend/providers/auth/pollAuthFlow';
import { readSecretValue } from '@/app/backend/providers/auth/secretRefs';
import { startAuthFlow } from '@/app/backend/providers/auth/startAuthFlow';
import type { PollAuthResult, ProviderAccountContextResult, StartAuthResult } from '@/app/backend/providers/auth/types';
import { providerIds } from '@/app/backend/runtime/contracts';
import type { ProviderAuthMethod, RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { appLog } from '@/app/main/logging';

export class ProviderAuthExecutionService {
    private readonly refreshLocks = new Map<string, Promise<ProviderAuthStateRecord>>();

    listAuthMethods(profileId: string): Array<{ providerId: RuntimeProviderId; methods: ProviderAuthMethod[] }> {
        void profileId;
        return providerIds.map((providerId) => ({
            providerId,
            methods: AUTH_METHODS_BY_PROVIDER[providerId],
        }));
    }

    getAuthState(profileId: string, providerId: RuntimeProviderId): Promise<ProviderAuthStateRecord> {
        return getAuthState(profileId, providerId);
    }

    setApiKey(profileId: string, providerId: RuntimeProviderId, apiKey: string): Promise<ProviderAuthStateRecord> {
        return setApiKey(profileId, providerId, apiKey).then((result) => {
            if (result.isErr()) {
                appLog.warn({
                    tag: 'provider.auth',
                    message: 'Failed to set provider API key.',
                    profileId,
                    providerId,
                    code: result.error.code,
                    error: result.error.message,
                });
                throw toAuthExecutionException(result.error);
            }

            return result.value;
        });
    }

    clearAuth(
        profileId: string,
        providerId: RuntimeProviderId
    ): Promise<{ cleared: boolean; authState: ProviderAuthStateRecord }> {
        return clearAuth(profileId, providerId).then((result) => {
            if (result.isErr()) {
                appLog.warn({
                    tag: 'provider.auth',
                    message: 'Failed to clear provider auth.',
                    profileId,
                    providerId,
                    code: result.error.code,
                    error: result.error.message,
                });
                throw toAuthExecutionException(result.error);
            }

            return result.value;
        });
    }

    async startAuth(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        method: ProviderAuthMethod;
    }): Promise<StartAuthResult> {
        const providerCheck = await ensureProviderExists(input.providerId);
        if (providerCheck.isErr()) {
            throw toAuthExecutionException(providerCheck.error);
        }
        const result = await startAuthFlow(input);
        if (result.isErr()) {
            appLog.warn({
                tag: 'provider.auth',
                message: 'Failed to start provider auth flow.',
                profileId: input.profileId,
                providerId: input.providerId,
                method: input.method,
                code: result.error.code,
                error: result.error.message,
            });
            throw toAuthExecutionException(result.error);
        }

        appLog.info({
            tag: 'provider.auth',
            message: 'Started provider auth flow.',
            profileId: input.profileId,
            providerId: input.providerId,
            method: input.method,
            flowId: result.value.flow.id,
        });

        return result.value;
    }

    async pollAuth(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        flowId: string;
    }): Promise<PollAuthResult> {
        const providerCheck = await ensureProviderExists(input.providerId);
        if (providerCheck.isErr()) {
            throw toAuthExecutionException(providerCheck.error);
        }
        const result = await pollAuthFlow(input);
        if (result.isErr()) {
            appLog.warn({
                tag: 'provider.auth',
                message: 'Failed to poll provider auth flow.',
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
                code: result.error.code,
                error: result.error.message,
            });
            throw toAuthExecutionException(result.error);
        }

        return result.value;
    }

    async completeAuth(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        flowId: string;
        code?: string;
    }): Promise<PollAuthResult> {
        const providerCheck = await ensureProviderExists(input.providerId);
        if (providerCheck.isErr()) {
            throw toAuthExecutionException(providerCheck.error);
        }
        const result = await completeAuthFlow(input);
        if (result.isErr()) {
            appLog.warn({
                tag: 'provider.auth',
                message: 'Failed to complete provider auth flow.',
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
                code: result.error.code,
                error: result.error.message,
            });
            throw toAuthExecutionException(result.error);
        }

        appLog.info({
            tag: 'provider.auth',
            message: 'Completed provider auth flow.',
            profileId: input.profileId,
            providerId: input.providerId,
            flowId: input.flowId,
            authState: result.value.state.authState,
        });

        return result.value;
    }

    async cancelAuth(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        flowId: string;
    }): Promise<PollAuthResult> {
        const providerCheck = await ensureProviderExists(input.providerId);
        if (providerCheck.isErr()) {
            throw toAuthExecutionException(providerCheck.error);
        }
        const result = await cancelAuthFlow(input);
        if (result.isErr()) {
            appLog.warn({
                tag: 'provider.auth',
                message: 'Failed to cancel provider auth flow.',
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
                code: result.error.code,
                error: result.error.message,
            });
            throw toAuthExecutionException(result.error);
        }

        appLog.info({
            tag: 'provider.auth',
            message: 'Cancelled provider auth flow.',
            profileId: input.profileId,
            providerId: input.providerId,
            flowId: input.flowId,
        });

        return result.value;
    }

    async refreshAuth(profileId: string, providerId: RuntimeProviderId): Promise<ProviderAuthStateRecord> {
        const providerCheck = await ensureProviderExists(providerId);
        if (providerCheck.isErr()) {
            throw toAuthExecutionException(providerCheck.error);
        }
        if (providerId !== 'openai') {
            const error = {
                code: 'refresh_not_supported' as const,
                message: 'Refresh auth is currently supported only for openai.',
            };
            appLog.warn({
                tag: 'provider.auth',
                message: error.message,
                profileId,
                providerId,
                code: error.code,
            });
            throw toAuthExecutionException(error);
        }

        const lockKey = `${profileId}:${providerId}`;
        const inFlight = this.refreshLocks.get(lockKey);
        if (inFlight) {
            return inFlight;
        }

        const refreshPromise = (async () => {
            const refreshToken = await readSecretValue(profileId, providerId, 'refresh_token');
            if (!refreshToken) {
                const error = {
                    code: 'refresh_token_missing' as const,
                    message: 'No refresh token configured for provider.',
                };
                throw toAuthExecutionException(error);
            }

            const tokenResult = await refreshOpenAIToken(refreshToken);
            if (tokenResult.isErr()) {
                throw toAuthExecutionException(tokenResult.error);
            }
            const token = tokenResult.value;
            return persistAuthenticatedState({
                profileId,
                providerId,
                authMethod: 'oauth_pkce',
                accessToken: token.accessToken,
                refreshToken: token.refreshToken ?? refreshToken,
                ...(token.expiresAt ? { tokenExpiresAt: token.expiresAt } : {}),
                ...(token.accountId ? { accountId: token.accountId } : {}),
            });
        })();

        this.refreshLocks.set(lockKey, refreshPromise);
        try {
            const state = await refreshPromise;
            appLog.info({
                tag: 'provider.auth',
                message: 'Refreshed provider auth token.',
                profileId,
                providerId,
                authState: state.authState,
            });
            return state;
        } finally {
            this.refreshLocks.delete(lockKey);
        }
    }

    getAccountContext(profileId: string, providerId: RuntimeProviderId): Promise<ProviderAccountContextResult> {
        return getAccountContext(profileId, providerId);
    }

    setOrganization(
        profileId: string,
        providerId: 'kilo',
        organizationId?: string | null
    ): Promise<ProviderAccountContextResult> {
        return setOrganizationContext(profileId, providerId, organizationId);
    }
}

export const providerAuthExecutionService = new ProviderAuthExecutionService();
