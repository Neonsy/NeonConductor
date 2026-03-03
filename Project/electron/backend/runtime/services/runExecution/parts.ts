import type { ProviderRuntimePart } from '@/app/backend/providers/types';

const reasoningPartTypes = new Set<ProviderRuntimePart['partType']>([
    'reasoning',
    'reasoning_summary',
    'reasoning_encrypted',
]);

export function isReasoningPart(partType: ProviderRuntimePart['partType']): boolean {
    return reasoningPartTypes.has(partType);
}
