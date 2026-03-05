import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

function compareByKiloRanking(left: ProviderModelRecord, right: ProviderModelRecord): number {
    const leftPrice = left.price;
    const rightPrice = right.price;
    if (leftPrice !== undefined && rightPrice !== undefined && leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
    }

    const leftLatency = left.latency;
    const rightLatency = right.latency;
    if (leftLatency !== undefined && rightLatency !== undefined && leftLatency !== rightLatency) {
        return leftLatency - rightLatency;
    }

    const leftTps = left.tps;
    const rightTps = right.tps;
    if (leftTps !== undefined && rightTps !== undefined && leftTps !== rightTps) {
        return rightTps - leftTps;
    }

    return left.label.localeCompare(right.label);
}

export function sortProviderModels(
    providerId: RuntimeProviderId,
    models: ProviderModelRecord[]
): ProviderModelRecord[] {
    if (providerId !== 'kilo') {
        return models.slice().sort((left, right) => left.label.localeCompare(right.label));
    }

    return models.slice().sort(compareByKiloRanking);
}
