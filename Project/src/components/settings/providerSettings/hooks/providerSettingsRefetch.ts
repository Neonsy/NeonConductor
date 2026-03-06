interface Refetchable {
    refetch: () => Promise<unknown>;
}

export function createProviderSettingsRefetchers(input: {
    providersQuery: Refetchable;
    defaultsQuery: Refetchable;
    authStateQuery: Refetchable;
    listModelsQuery: Refetchable;
    kiloRoutingPreferenceQuery: Refetchable;
    kiloModelProvidersQuery: Refetchable;
    accountContextQuery: Refetchable;
    openAISubscriptionRateLimitsQuery: Refetchable;
}) {
    return {
        refetchProviders: () => {
            void input.providersQuery.refetch();
        },
        refetchDefaults: () => {
            void input.defaultsQuery.refetch();
        },
        refetchAuthState: () => {
            void input.authStateQuery.refetch();
        },
        refetchListModels: () => {
            void input.listModelsQuery.refetch();
        },
        refetchKiloRoutingPreference: () => {
            void input.kiloRoutingPreferenceQuery.refetch();
        },
        refetchKiloModelProviders: () => {
            void input.kiloModelProvidersQuery.refetch();
        },
        refetchAccountContext: () => {
            void input.accountContextQuery.refetch();
        },
        refetchOpenAIRateLimits: () => {
            void input.openAISubscriptionRateLimitsQuery.refetch();
        },
    };
}
