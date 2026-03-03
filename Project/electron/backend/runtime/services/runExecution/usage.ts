export interface UsageAccumulator {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function mergeUsage(current: UsageAccumulator, next: unknown): UsageAccumulator {
    const merged: UsageAccumulator = {};

    if (current.inputTokens !== undefined) merged.inputTokens = current.inputTokens;
    if (current.outputTokens !== undefined) merged.outputTokens = current.outputTokens;
    if (current.cachedTokens !== undefined) merged.cachedTokens = current.cachedTokens;
    if (current.reasoningTokens !== undefined) merged.reasoningTokens = current.reasoningTokens;
    if (current.totalTokens !== undefined) merged.totalTokens = current.totalTokens;
    if (current.latencyMs !== undefined) merged.latencyMs = current.latencyMs;
    if (current.costMicrounits !== undefined) merged.costMicrounits = current.costMicrounits;

    if (isRecord(next)) {
        const inputTokens = readOptionalFiniteNumber(next['inputTokens']);
        const outputTokens = readOptionalFiniteNumber(next['outputTokens']);
        const cachedTokens = readOptionalFiniteNumber(next['cachedTokens']);
        const reasoningTokens = readOptionalFiniteNumber(next['reasoningTokens']);
        const totalTokens = readOptionalFiniteNumber(next['totalTokens']);
        const latencyMs = readOptionalFiniteNumber(next['latencyMs']);
        const costMicrounits = readOptionalFiniteNumber(next['costMicrounits']);

        if (inputTokens !== undefined) merged.inputTokens = inputTokens;
        if (outputTokens !== undefined) merged.outputTokens = outputTokens;
        if (cachedTokens !== undefined) merged.cachedTokens = cachedTokens;
        if (reasoningTokens !== undefined) merged.reasoningTokens = reasoningTokens;
        if (totalTokens !== undefined) merged.totalTokens = totalTokens;
        if (latencyMs !== undefined) merged.latencyMs = latencyMs;
        if (costMicrounits !== undefined) merged.costMicrounits = costMicrounits;
    }

    return merged;
}
