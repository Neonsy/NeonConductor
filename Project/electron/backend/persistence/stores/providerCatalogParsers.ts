import { parseEnumValue, parseJsonRecord } from '@/app/backend/persistence/stores/rowParsers';
import { isJsonUnknownArray, parseJsonValue } from '@/app/backend/persistence/stores/utils';
import type { ProviderModelModality } from '@/app/backend/providers/types';
import { providerIds } from '@/app/backend/runtime/contracts';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export const modelModalities = ['text', 'audio', 'image', 'video', 'pdf'] as const;

export function parseProviderId(value: string, field: string): RuntimeProviderId {
    return parseEnumValue(value, field, providerIds);
}

export function isModelModality(value: unknown): value is ProviderModelModality {
    return typeof value === 'string' && modelModalities.some((modality) => modality === value);
}

export function normalizeModalities(input?: ProviderModelModality[]): ProviderModelModality[] {
    if (!input || input.length === 0) {
        return ['text'];
    }

    const normalized = input.filter((modality) => modelModalities.some((candidate) => candidate === modality));
    if (!normalized.includes('text')) {
        normalized.unshift('text');
    }

    return Array.from(new Set(normalized));
}

export function parseModalities(value: string | null): ProviderModelModality[] {
    if (value === null) {
        return ['text'];
    }

    const parsed = parseJsonValue(value, [], isJsonUnknownArray);
    const normalized = parsed.filter(isModelModality);
    if (!normalized.includes('text')) {
        normalized.unshift('text');
    }

    return Array.from(new Set(normalized));
}

export function parseJsonObject(value: string): Record<string, unknown> {
    return parseJsonRecord(value);
}

export function readNumberFromRecord(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = Number.parseFloat(value);
        if (Number.isFinite(normalized)) {
            return normalized;
        }
    }

    return undefined;
}

export function readNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = source[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const record: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        record[entryKey] = entryValue;
    }
    return record;
}
