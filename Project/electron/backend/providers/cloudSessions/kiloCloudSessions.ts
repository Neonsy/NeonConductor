// Adapted from Kilo-Org/kilocode packages/kilo-gateway/src/cloud-sessions.ts
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INGEST_BASE = process.env['KILO_SESSION_INGEST_URL'] ?? 'https://ingest.kilosessions.ai';
const HEADER_EDITOR_NAME = 'X-KILOCODE-EDITORNAME';
const DEFAULT_EDITOR_NAME = 'NeonConductor';

function exportUrl(sessionId: string): string {
    return UUID_RE.test(sessionId)
        ? `${INGEST_BASE}/session/${sessionId}`
        : `${INGEST_BASE}/api/session/${sessionId}/export`;
}

export interface CloudFetchResult {
    ok: boolean;
    status: number;
    data?: Record<string, unknown>;
    error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function fetchCloudSession(token: string, sessionId: string): Promise<CloudFetchResult> {
    const response = await fetch(exportUrl(sessionId), {
        headers: {
            Authorization: `Bearer ${token}`,
            [HEADER_EDITOR_NAME]: DEFAULT_EDITOR_NAME,
        },
    });

    if (response.status === 404) {
        return { ok: false, status: 404, error: 'Session not found' };
    }

    if (!response.ok) {
        return { ok: false, status: response.status, error: 'Failed to fetch session' };
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
        return { ok: false, status: response.status, error: 'Invalid session payload' };
    }

    const data = payload;
    return { ok: true, status: 200, data };
}
