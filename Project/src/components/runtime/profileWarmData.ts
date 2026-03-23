import { resolveActiveWorkspaceProfileId } from '@/web/components/runtime/workspaceSurfaceModel';

interface WarmProfileRecord {
    id: string;
    isActive: boolean;
}

interface WarmProfileListPayload {
    profiles: WarmProfileRecord[];
}

interface WarmActiveProfilePayload {
    activeProfileId: string | undefined;
}

function isWarmProfileRecord(value: unknown): value is WarmProfileRecord {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return typeof record['id'] === 'string' && typeof record['isActive'] === 'boolean';
}

export function isWarmProfileListPayload(value: unknown): value is WarmProfileListPayload {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return Array.isArray(record['profiles']) && record['profiles'].every(isWarmProfileRecord);
}

export function isWarmActiveProfilePayload(value: unknown): value is WarmActiveProfilePayload {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return record['activeProfileId'] === undefined || typeof record['activeProfileId'] === 'string';
}

export function resolveWarmProfileId(input: {
    profileListPayload: WarmProfileListPayload;
    activeProfilePayload: WarmActiveProfilePayload;
}): string | undefined {
    return resolveActiveWorkspaceProfileId({
        activeProfileId: undefined,
        serverActiveProfileId: input.activeProfilePayload.activeProfileId,
        profiles: input.profileListPayload.profiles,
    });
}
