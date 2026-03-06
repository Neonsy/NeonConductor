import { providerManagementService } from '@/app/backend/providers/service';
import {
    providerByIdInputSchema,
    providerCancelAuthInputSchema,
    providerClearAuthInputSchema,
    providerCompleteAuthInputSchema,
    providerGetAccountContextInputSchema,
    providerGetEndpointProfileInputSchema,
    providerGetModelRoutingPreferenceInputSchema,
    providerListAuthMethodsInputSchema,
    providerListModelProvidersInputSchema,
    providerListModelsInputSchema,
    providerListProvidersInputSchema,
    providerPollAuthInputSchema,
    providerRefreshAuthInputSchema,
    providerSetApiKeyInputSchema,
    providerSetDefaultInputSchema,
    providerSetEndpointProfileInputSchema,
    providerSetModelRoutingPreferenceInputSchema,
    providerSetOrganizationInputSchema,
    providerStartAuthInputSchema,
    providerSyncCatalogInputSchema,
} from '@/app/backend/runtime/contracts';
import { runtimeStatusEvent, runtimeSyncEvent, runtimeUpsertEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

function throwWithCode(code: string, message: string): never {
    const error = new Error(message);
    (error as { code?: string }).code = code;
    throw error;
}

function mapAuthErrorToOperationalCode(code: string): string {
    if (code === 'method_not_supported' || code === 'method_not_implemented' || code === 'refresh_not_supported') {
        return 'provider_auth_unsupported';
    }
    if (code === 'pkce_code_required') {
        return 'invalid_payload';
    }

    return code;
}

export const providerRouter = router({
    listProviders: publicProcedure.input(providerListProvidersInputSchema).query(async ({ input }) => {
        return { providers: await providerManagementService.listProviders(input.profileId) };
    }),
    getDefaults: publicProcedure.input(providerListProvidersInputSchema).query(async ({ input }) => {
        return {
            defaults: await providerManagementService.getDefaults(input.profileId),
        };
    }),
    getUsageSummary: publicProcedure.input(providerListProvidersInputSchema).query(async ({ input }) => {
        return { summaries: await providerManagementService.listUsageSummaries(input.profileId) };
    }),
    getOpenAISubscriptionUsage: publicProcedure.input(providerListProvidersInputSchema).query(async ({ input }) => {
        return { usage: await providerManagementService.getOpenAISubscriptionUsage(input.profileId) };
    }),
    getOpenAISubscriptionRateLimits: publicProcedure
        .input(providerListProvidersInputSchema)
        .query(async ({ input }) => {
            return { rateLimits: await providerManagementService.getOpenAISubscriptionRateLimits(input.profileId) };
        }),
    listModels: publicProcedure.input(providerListModelsInputSchema).query(async ({ input }) => {
        const modelsResult = await providerManagementService.listModels(input.profileId, input.providerId);
        if (modelsResult.isErr()) {
            if (
                modelsResult.error.code === 'provider_not_supported' ||
                modelsResult.error.code === 'provider_not_registered'
            ) {
                return { models: [], reason: 'provider_not_found' as const };
            }

            throwWithCode(modelsResult.error.code, modelsResult.error.message);
        }

        return {
            models: modelsResult.value,
            reason: null,
        };
    }),
    listAuthMethods: publicProcedure.input(providerListAuthMethodsInputSchema).query(({ input }) => {
        return {
            methods: providerManagementService.listAuthMethods(input.profileId),
        };
    }),
    getAuthState: publicProcedure.input(providerByIdInputSchema).query(async ({ input }) => {
        const state = await providerManagementService.getAuthState(input.profileId, input.providerId);
        return {
            found: true as const,
            state,
        };
    }),
    startAuth: publicProcedure.input(providerStartAuthInputSchema).mutation(async ({ input, ctx }) => {
        const result = await providerManagementService.startAuth(input, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.started',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                method: input.method,
                flowId: result.value.flow.id,
            },
            })
        );

        return result.value;
    }),
    pollAuth: publicProcedure.input(providerPollAuthInputSchema).mutation(async ({ input, ctx }) => {
        const result = await providerManagementService.pollAuth(input, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.polled',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
                flowStatus: result.value.flow.status,
                authState: result.value.state.authState,
            },
            })
        );

        return result.value;
    }),
    completeAuth: publicProcedure.input(providerCompleteAuthInputSchema).mutation(async ({ input, ctx }) => {
        const result = await providerManagementService.completeAuth(input, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.completed',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
                flowStatus: result.value.flow.status,
                authState: result.value.state.authState,
            },
            })
        );

        return result.value;
    }),
    cancelAuth: publicProcedure.input(providerCancelAuthInputSchema).mutation(async ({ input, ctx }) => {
        const result = await providerManagementService.cancelAuth(input, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.cancelled',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                flowId: input.flowId,
            },
            })
        );

        return result.value;
    }),
    refreshAuth: publicProcedure.input(providerRefreshAuthInputSchema).mutation(async ({ input, ctx }) => {
        const stateResult = await providerManagementService.refreshAuth(input.profileId, input.providerId, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (stateResult.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(stateResult.error.code), stateResult.error.message);
        }
        const state = stateResult.value;
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.refreshed',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                authState: state.authState,
            },
            })
        );

        return { state };
    }),
    getAccountContext: publicProcedure.input(providerGetAccountContextInputSchema).query(async ({ input }) => {
        const result = await providerManagementService.getAccountContext(input.profileId, input.providerId);
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        return result.value;
    }),
    getEndpointProfile: publicProcedure.input(providerGetEndpointProfileInputSchema).query(async ({ input }) => {
        const endpointResult = await providerManagementService.getEndpointProfile(input.profileId, input.providerId);
        if (endpointResult.isErr()) {
            throwWithCode(endpointResult.error.code, endpointResult.error.message);
        }
        return {
            endpointProfile: endpointResult.value,
        };
    }),
    setEndpointProfile: publicProcedure
        .input(providerSetEndpointProfileInputSchema)
        .mutation(async ({ input, ctx }) => {
            const endpointResult = await providerManagementService.setEndpointProfile(
                input.profileId,
                input.providerId,
                input.value,
                {
                    requestId: ctx.requestId,
                    correlationId: ctx.correlationId,
                }
            );
            if (endpointResult.isErr()) {
                throwWithCode(endpointResult.error.code, endpointResult.error.message);
            }
            const endpointProfile = endpointResult.value;
            await runtimeEventLogService.append(
                runtimeUpsertEvent({
                entityType: 'provider',
                domain: 'provider',
                entityId: input.providerId,
                eventType: 'provider.endpoint-profile.set',
                payload: {
                    profileId: input.profileId,
                    providerId: input.providerId,
                    value: endpointProfile.value,
                },
                })
            );

            return { endpointProfile };
        }),
    setOrganization: publicProcedure.input(providerSetOrganizationInputSchema).mutation(async ({ input }) => {
        const result = await providerManagementService.setOrganization(
            input.profileId,
            input.providerId,
            input.organizationId
        );
        if (result.isErr()) {
            throwWithCode(mapAuthErrorToOperationalCode(result.error.code), result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeUpsertEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.organization.set',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                organizationId: input.organizationId ?? null,
            },
            })
        );

        return result.value;
    }),
    getModelRoutingPreference: publicProcedure
        .input(providerGetModelRoutingPreferenceInputSchema)
        .query(async ({ input }) => {
            return {
                preference: await providerManagementService.getModelRoutingPreference(input),
            };
        }),
    setModelRoutingPreference: publicProcedure
        .input(providerSetModelRoutingPreferenceInputSchema)
        .mutation(async ({ input }) => {
            const preference = await providerManagementService.setModelRoutingPreference(input);
            await runtimeEventLogService.append(
                runtimeUpsertEvent({
                entityType: 'provider',
                domain: 'provider',
                entityId: input.providerId,
                eventType: 'provider.kilo-routing.set',
                payload: {
                    profileId: input.profileId,
                    providerId: input.providerId,
                    modelId: input.modelId,
                    routingMode: preference.routingMode,
                    sort: preference.sort ?? null,
                    pinnedProviderId: preference.pinnedProviderId ?? null,
                },
                })
            );

            return { preference };
        }),
    listModelProviders: publicProcedure.input(providerListModelProvidersInputSchema).query(async ({ input }) => {
        return {
            providers: await providerManagementService.listModelProviders(input),
        };
    }),
    setApiKey: publicProcedure.input(providerSetApiKeyInputSchema).mutation(async ({ input, ctx }) => {
        const stateResult = await providerManagementService.setApiKey(input.profileId, input.providerId, input.apiKey, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (stateResult.isErr()) {
            if (stateResult.error.code === 'method_not_supported') {
                return {
                    success: false as const,
                    reason: 'provider_not_found' as const,
                };
            }
            throwWithCode(mapAuthErrorToOperationalCode(stateResult.error.code), stateResult.error.message);
        }
        await runtimeEventLogService.append(
            runtimeUpsertEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.api-key-set',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
            },
            })
        );

        return {
            success: true as const,
            reason: null,
            state: stateResult.value,
        };
    }),
    clearAuth: publicProcedure.input(providerClearAuthInputSchema).mutation(async ({ input, ctx }) => {
        const clearResult = await providerManagementService.clearAuth(input.profileId, input.providerId, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (clearResult.isErr()) {
            if (clearResult.error.code === 'method_not_supported') {
                return {
                    success: false as const,
                    reason: 'provider_not_found' as const,
                };
            }
            throwWithCode(mapAuthErrorToOperationalCode(clearResult.error.code), clearResult.error.message);
        }
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.auth.cleared',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
            },
            })
        );

        return {
            success: true as const,
            reason: null,
            ...clearResult.value,
        };
    }),
    syncCatalog: publicProcedure.input(providerSyncCatalogInputSchema).mutation(async ({ input, ctx }) => {
        const result = await providerManagementService.syncCatalog(input.profileId, input.providerId, input.force, {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
        });
        if (result.isErr()) {
            if (result.error.code === 'provider_not_supported' || result.error.code === 'provider_not_registered') {
                return {
                    ok: false as const,
                    status: 'error' as const,
                    providerId: input.providerId,
                    reason: 'provider_not_found' as const,
                    modelCount: 0,
                };
            }
            throwWithCode(result.error.code, result.error.message);
        }
        await runtimeEventLogService.append(
            runtimeSyncEvent({
            entityType: 'provider',
            domain: 'provider',
            entityId: input.providerId,
            eventType: 'provider.catalog.sync',
            payload: {
                profileId: input.profileId,
                providerId: input.providerId,
                ok: result.value.ok,
                status: result.value.status,
                reason: result.value.reason ?? null,
                modelCount: result.value.modelCount,
            },
            })
        );
        return result.value;
    }),
    setDefault: publicProcedure.input(providerSetDefaultInputSchema).mutation(async ({ input }) => {
        const result = await providerManagementService.setDefault(input.profileId, input.providerId, input.modelId);

        if (result.success) {
            await runtimeEventLogService.append(
                runtimeUpsertEvent({
                entityType: 'provider',
                domain: 'provider',
                entityId: input.providerId,
                eventType: 'provider.default-set',
                payload: {
                    profileId: input.profileId,
                    providerId: input.providerId,
                    modelId: input.modelId,
                },
                })
            );
        }

        return result;
    }),
});
