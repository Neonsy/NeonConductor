import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { analyzeSourceText, shouldSkipFile } from '@/scripts/quality-report';

const execFile = promisify(execFileCallback);
const PREFERRED_MAX_LINES = 1000;

interface FileDebtSnapshot {
    broadCastHits: number;
    notImplementedHits: number;
    lines: number;
}

interface Violation {
    file: string;
    rule: 'broad_cast_increase' | 'loc_preferred_limit_crossed' | 'ungoverned_unsupported_increase';
    message: string;
}

function parseBaseRefArg(argv: string[]): string {
    const flagIndex = argv.findIndex((value) => value === '--base');
    if (flagIndex >= 0) {
        const candidate = argv[flagIndex + 1];
        if (candidate && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return process.env['QUALITY_BASE_REF']?.trim() || 'origin/main';
}

async function readGitFileAtRef(ref: string, filePath: string): Promise<string | null> {
    try {
        const { stdout } = await execFile('git', ['show', `${ref}:${filePath}`], { encoding: 'utf8' });
        return stdout;
    } catch {
        return null;
    }
}

function hasUnsupportedGovernanceMarkers(sourceText: string): boolean {
    const includesNotImplemented =
        sourceText.includes('not_implemented') || sourceText.includes('method_not_implemented');
    const includesMessage = sourceText.includes('message');
    const includesReason = sourceText.includes('unsupportedReason') || sourceText.includes('reason');
    return includesNotImplemented && includesMessage && includesReason;
}

function snapshotFromSource(sourceText: string, filePath: string): FileDebtSnapshot {
    const analyzed = analyzeSourceText(sourceText, filePath);
    return {
        broadCastHits: analyzed.broadCastHits,
        notImplementedHits: analyzed.notImplementedHits,
        lines: sourceText.split(/\r?\n/).length,
    };
}

async function main(): Promise<void> {
    const baseRef = parseBaseRefArg(process.argv.slice(2));
    const { stdout } = await execFile('git', ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], {
        encoding: 'utf8',
    });

    const changedFiles = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => line.startsWith('electron/') || line.startsWith('src/'))
        .filter((line) => line.endsWith('.ts') || line.endsWith('.tsx'))
        .filter((line) => !shouldSkipFile(line));

    const violations: Violation[] = [];

    for (const filePath of changedFiles) {
        const currentSource = await readFile(filePath, 'utf8');
        const current = snapshotFromSource(currentSource, filePath);

        const baselineSource = await readGitFileAtRef(baseRef, filePath);
        const baseline = baselineSource
            ? snapshotFromSource(baselineSource, filePath)
            : ({
                  broadCastHits: 0,
                  notImplementedHits: 0,
                  lines: 0,
              } satisfies FileDebtSnapshot);

        if (current.broadCastHits > baseline.broadCastHits) {
            violations.push({
                file: filePath,
                rule: 'broad_cast_increase',
                message: `Broad casts increased (${String(baseline.broadCastHits)} -> ${String(current.broadCastHits)}).`,
            });
        }

        if (current.lines > PREFERRED_MAX_LINES && baseline.lines <= PREFERRED_MAX_LINES) {
            violations.push({
                file: filePath,
                rule: 'loc_preferred_limit_crossed',
                message: `File crossed preferred ${String(PREFERRED_MAX_LINES)} LOC threshold (${String(current.lines)} lines).`,
            });
        }

        if (
            current.notImplementedHits > baseline.notImplementedHits &&
            !hasUnsupportedGovernanceMarkers(currentSource)
        ) {
            violations.push({
                file: filePath,
                rule: 'ungoverned_unsupported_increase',
                message: 'Unsupported-path markers increased without explicit reason/message governance fields.',
            });
        }
    }

    if (violations.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`quality:gate:changed passed (${String(changedFiles.length)} changed production files scanned).`);
        return;
    }

    // eslint-disable-next-line no-console
    console.error('quality:gate:changed failed:');
    for (const violation of violations) {
        // eslint-disable-next-line no-console
        console.error(`- ${violation.file} [${violation.rule}] ${violation.message}`);
    }
    process.exitCode = 1;
}

void main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
});
