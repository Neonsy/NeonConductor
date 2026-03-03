import type { ProviderModelModality } from '@/app/backend/providers/types';

const allowedModalities: ProviderModelModality[] = ['text', 'audio', 'image', 'video', 'pdf'];

function isModelModality(value: string): value is ProviderModelModality {
    return allowedModalities.includes(value as ProviderModelModality);
}

export function normalizeModalities(input: string[] | undefined): ProviderModelModality[] {
    if (!input || input.length === 0) {
        return ['text'];
    }

    const normalized = input.filter(isModelModality);
    if (!normalized.includes('text')) {
        normalized.unshift('text');
    }

    return Array.from(new Set(normalized));
}
