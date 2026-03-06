export interface RoutingPreferenceView {
    routingMode: 'dynamic' | 'pinned';
    sort?: 'default' | 'price' | 'throughput' | 'latency';
    pinnedProviderId?: string | null;
}

export function formatRoutingBadge(
    providerId: string | undefined,
    preference: RoutingPreferenceView | undefined
): string | undefined {
    if (providerId !== 'kilo') {
        return undefined;
    }

    if (preference?.routingMode === 'pinned') {
        return `Routing: Pinned (${preference.pinnedProviderId ?? 'unknown'})`;
    }

    return `Routing: Dynamic (${
        preference?.sort === 'price'
            ? 'Lowest Price'
            : preference?.sort === 'throughput'
              ? 'Highest Throughput'
              : preference?.sort === 'latency'
                ? 'Lowest Latency'
                : 'Default'
    })`;
}
