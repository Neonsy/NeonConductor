import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

interface FileMetric {
    file: string;
    lines: number;
    castHits: number;
    broadCastHits: number;
    asConstHits: number;
    notImplementedHits: number;
}

interface QualitySummary {
    filesScanned: number;
    totalLines: number;
    totalCastHits: number;
    totalBroadCastHits: number;
    totalAsConstHits: number;
    totalNotImplementedHits: number;
    filesOverPreferredLimit: FileMetric[];
    topCastHotspots: FileMetric[];
    topNotImplementedHotspots: FileMetric[];
}

const SCAN_ROOTS = ['src', 'electron'];
const PREFERRED_MAX_LINES = 1000;

const IGNORED_PATH_SEGMENTS = new Set(['node_modules', 'dist', 'dist-electron', 'release']);

function isTypeScriptSource(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

export function shouldSkipFile(filePath: string): boolean {
    if (!isTypeScriptSource(filePath)) {
        return true;
    }

    const normalized = filePath.replaceAll('\\', '/');
    if (normalized.includes('/__tests__/')) {
        return true;
    }
    if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) {
        return true;
    }
    if (normalized.endsWith('/generatedMigrations.ts')) {
        return true;
    }
    if (normalized.endsWith('.gen.ts') || normalized.endsWith('.gen.tsx')) {
        return true;
    }
    if (normalized.includes('/assets/')) {
        return true;
    }

    return false;
}

function getScriptKind(filePath: string): ts.ScriptKind {
    return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function isAsConstAssertion(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): boolean {
    if (typeNode.kind === ts.SyntaxKind.ConstKeyword) {
        return true;
    }

    return ts.isTypeReferenceNode(typeNode) && typeNode.typeName.getText(sourceFile) === 'const';
}

export function countCastHits(
    sourceText: string,
    filePath: string
): Pick<FileMetric, 'castHits' | 'broadCastHits' | 'asConstHits'> {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
    let castHits = 0;
    let broadCastHits = 0;
    let asConstHits = 0;

    const visit = (node: ts.Node): void => {
        if (ts.isAsExpression(node)) {
            castHits += 1;
            if (isAsConstAssertion(node.type, sourceFile)) {
                asConstHits += 1;
            } else {
                broadCastHits += 1;
            }
        }

        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return {
        castHits,
        broadCastHits,
        asConstHits,
    };
}

function countNotImplementedHits(lines: string[]): number {
    let notImplementedHits = 0;

    for (const line of lines) {
        const trimmed = line.trimStart();
        const lower = trimmed.toLowerCase();
        if (lower.includes('not_implemented') || lower.includes('not implemented')) {
            notImplementedHits += 1;
        }
    }

    return notImplementedHits;
}

export function analyzeSourceText(sourceText: string, filePath: string): Omit<FileMetric, 'file' | 'lines'> {
    const lines = sourceText.split(/\r?\n/);
    const castHits = countCastHits(sourceText, filePath);
    return {
        castHits: castHits.castHits,
        broadCastHits: castHits.broadCastHits,
        asConstHits: castHits.asConstHits,
        notImplementedHits: countNotImplementedHits(lines),
    };
}

async function scanDirectory(rootPath: string, currentPath: string, metrics: FileMetric[]): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            if (IGNORED_PATH_SEGMENTS.has(entry.name)) {
                continue;
            }
            await scanDirectory(rootPath, entryPath, metrics);
            continue;
        }

        if (!entry.isFile() || shouldSkipFile(entryPath)) {
            continue;
        }

        const content = await readFile(entryPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const analyzed = analyzeSourceText(content, entryPath);
        metrics.push({
            file: path.relative(rootPath, entryPath).replaceAll('\\', '/'),
            lines: lines.length,
            castHits: analyzed.castHits,
            broadCastHits: analyzed.broadCastHits,
            asConstHits: analyzed.asConstHits,
            notImplementedHits: analyzed.notImplementedHits,
        });
    }
}

export function buildSummary(metrics: FileMetric[]): QualitySummary {
    return {
        filesScanned: metrics.length,
        totalLines: metrics.reduce((acc, item) => acc + item.lines, 0),
        totalCastHits: metrics.reduce((acc, item) => acc + item.castHits, 0),
        totalBroadCastHits: metrics.reduce((acc, item) => acc + item.broadCastHits, 0),
        totalAsConstHits: metrics.reduce((acc, item) => acc + item.asConstHits, 0),
        totalNotImplementedHits: metrics.reduce((acc, item) => acc + item.notImplementedHits, 0),
        filesOverPreferredLimit: metrics
            .filter((item) => item.lines > PREFERRED_MAX_LINES)
            .sort((a, b) => b.lines - a.lines),
        topCastHotspots: metrics
            .filter((item) => item.broadCastHits > 0)
            .sort((a, b) => b.broadCastHits - a.broadCastHits)
            .slice(0, 20),
        topNotImplementedHotspots: metrics
            .filter((item) => item.notImplementedHits > 0)
            .sort((a, b) => b.notImplementedHits - a.notImplementedHits)
            .slice(0, 20),
    };
}

function printSummary(summary: QualitySummary): void {
    // eslint-disable-next-line no-console
    console.log('\nNeonConductor quality report (production TS/TSX only)');
    // eslint-disable-next-line no-console
    console.log(`Files scanned: ${String(summary.filesScanned)}`);
    // eslint-disable-next-line no-console
    console.log(`Total lines: ${String(summary.totalLines)}`);
    // eslint-disable-next-line no-console
    console.log(
        `Cast hits: ${String(summary.totalCastHits)} (broad: ${String(summary.totalBroadCastHits)}, as const: ${String(summary.totalAsConstHits)})`
    );
    // eslint-disable-next-line no-console
    console.log(`not_implemented hits: ${String(summary.totalNotImplementedHits)}`);

    // eslint-disable-next-line no-console
    console.log('\nFiles over preferred 1000 LOC target:');
    if (summary.filesOverPreferredLimit.length === 0) {
        // eslint-disable-next-line no-console
        console.log('  none');
    } else {
        for (const item of summary.filesOverPreferredLimit) {
            // eslint-disable-next-line no-console
            console.log(`  ${item.file} (${String(item.lines)} lines)`);
        }
    }

    // eslint-disable-next-line no-console
    console.log('\nTop broad-cast hotspots:');
    if (summary.topCastHotspots.length === 0) {
        // eslint-disable-next-line no-console
        console.log('  none');
    } else {
        for (const item of summary.topCastHotspots) {
            // eslint-disable-next-line no-console
            console.log(
                `  ${item.file}: ${String(item.broadCastHits)} broad casts (${String(item.castHits)} total casts)`
            );
        }
    }

    // eslint-disable-next-line no-console
    console.log('\nTop not_implemented hotspots:');
    if (summary.topNotImplementedHotspots.length === 0) {
        // eslint-disable-next-line no-console
        console.log('  none');
    } else {
        for (const item of summary.topNotImplementedHotspots) {
            // eslint-disable-next-line no-console
            console.log(`  ${item.file}: ${String(item.notImplementedHits)} hits`);
        }
    }
}

function printSummaryAsJson(summary: QualitySummary): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
    const repoRoot = process.cwd();
    const metrics: FileMetric[] = [];
    const outputAsJson = process.argv.includes('--json');

    for (const root of SCAN_ROOTS) {
        const absolute = path.join(repoRoot, root);
        await scanDirectory(repoRoot, absolute, metrics);
    }

    const summary = buildSummary(metrics);
    if (outputAsJson) {
        printSummaryAsJson(summary);
    } else {
        printSummary(summary);
    }
}

function isExecutedAsScript(): boolean {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }

    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
}

if (isExecutedAsScript()) {
    void main().catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exitCode = 1;
    });
}
