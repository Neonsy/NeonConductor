interface UpdateControlsPrefetchInput {
    trpcUtils: {
        updates: {
            getChannel: {
                prefetch: (input: undefined) => Promise<void>;
            };
            getSwitchStatus: {
                prefetch: (input: undefined) => Promise<void>;
            };
        };
    };
}

export function prefetchUpdateControlsData(input: UpdateControlsPrefetchInput): void {
    void Promise.all([
        input.trpcUtils.updates.getChannel.prefetch(undefined),
        input.trpcUtils.updates.getSwitchStatus.prefetch(undefined),
    ]);
}
