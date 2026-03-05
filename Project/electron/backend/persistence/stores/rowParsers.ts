import type { EntityId, EntityIdPrefix } from '@/app/backend/runtime/contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseEnumValue<const T extends readonly string[]>(
    value: string,
    field: string,
    allowedValues: T
): T[number] {
    if ((allowedValues as readonly string[]).includes(value)) {
        return value as T[number];
    }

    throw new Error(`Invalid "${field}" in persistence row: "${value}".`);
}

export function parseEntityId<P extends EntityIdPrefix>(value: string, field: string, prefix: P): EntityId<P> {
    const normalized = value.trim();
    const expectedPrefix = `${prefix}_`;
    if (!normalized.startsWith(expectedPrefix)) {
        throw new Error(`Invalid "${field}" in persistence row: expected "${expectedPrefix}..." ID.`);
    }

    return normalized as EntityId<P>;
}

export function parseJsonRecord(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (isRecord(parsed)) {
            return parsed;
        }
        return {};
    } catch {
        return {};
    }
}
