import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RUNTIME_BASELINE_VERSION = 'runtime-baseline-v4';
const BASELINE_MARKER_FILENAME = 'runtime-baseline.version';

function getBaselineMarkerPath(dbPath: string): string {
    return path.join(path.dirname(dbPath), BASELINE_MARKER_FILENAME);
}

export function shouldResetPersistenceBaseline(dbPath: string): boolean {
    if (dbPath === ':memory:') {
        return false;
    }

    const markerPath = getBaselineMarkerPath(dbPath);
    if (!existsSync(dbPath)) {
        return false;
    }
    if (!existsSync(markerPath)) {
        return true;
    }

    try {
        return readFileSync(markerPath, 'utf8').trim() !== RUNTIME_BASELINE_VERSION;
    } catch {
        return true;
    }
}

export function resetPersistenceBaseline(dbPath: string): void {
    if (dbPath === ':memory:') {
        return;
    }

    rmSync(dbPath, { force: true });
}

export function markPersistenceBaselineApplied(dbPath: string): void {
    if (dbPath === ':memory:') {
        return;
    }

    writeFileSync(getBaselineMarkerPath(dbPath), `${RUNTIME_BASELINE_VERSION}\n`, 'utf8');
}
