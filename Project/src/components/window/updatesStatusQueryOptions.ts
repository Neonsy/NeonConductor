import { SECONDARY_QUERY_OPTIONS } from '@/web/lib/query/secondaryQueryOptions';

const ACTIVE_UPDATE_PHASES = new Set(['checking', 'downloading', 'downloaded']);

export function isActiveUpdatePhase(phase: string | undefined): boolean {
    return typeof phase === 'string' && ACTIVE_UPDATE_PHASES.has(phase);
}

function readQueryPhase(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const candidate = value as { phase?: unknown };
    return typeof candidate.phase === 'string' ? candidate.phase : undefined;
}

export function getUpdatesStatusRefetchInterval(data: unknown): number | false {
    return isActiveUpdatePhase(readQueryPhase(data)) ? 300 : false;
}

export const UPDATES_STATUS_QUERY_OPTIONS = {
    ...SECONDARY_QUERY_OPTIONS,
    refetchIntervalInBackground: true,
} as const;
