import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { scriptLog } from '@/scripts/logger';

const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.turbo', 'release']);
const MAX_SOURCE_LINES = 999;
const TEST_FRAMEWORK_IMPORT_PATTERNS = ["from 'vitest'", 'from "vitest"', "from 'jest'", 'from "jest"'];
const BROAD_CAST_PATTERN = /\bas\s+[A-Z][A-Za-z0-9_<>,`'[\]|& ]+/;
const INLINE_LINT_SUPPRESSION_PATTERN = /\beslint-disable(?:-next-line|-line)?\b/;
const SOURCE_ROOT_DIRECTORIES = ['src', 'electron', 'scripts'];

export interface AuditViolation {
    path: string;
    line: number;
    message: string;
}

export interface AgentsConformanceReport {
    oversizedHandwrittenSourceFiles: AuditViolation[];
    inlineLintSuppressions: AuditViolation[];
    nonTestFrameworkImports: AuditViolation[];
    forbiddenLayoutEffects: AuditViolation[];
    rendererElectronImports: AuditViolation[];
    nonPreloadElectronBridgeUsage: AuditViolation[];
    insecureBrowserWindows: AuditViolation[];
    nonBlockingReactMemoization: AuditViolation[];
    nonBlockingSuspiciousEffects: AuditViolation[];
    nonBlockingAsyncEffects: AuditViolation[];
    nonBlockingBroadCasts: AuditViolation[];
    nonBlockingThrows: AuditViolation[];
}

interface AuditSourceFile {
    absolutePath: string;
    relativePath: string;
    content: string;
    lineCount: number;
}

function normalizeRelativePath(rootDir: string, absolutePath: string): string {
    return path.relative(rootDir, absolutePath).replaceAll('\\', '/');
}

function shouldSkipDirectory(name: string): boolean {
    return SKIPPED_DIRECTORIES.has(name);
}

function isSourceFile(absolutePath: string): boolean {
    return SOURCE_FILE_EXTENSIONS.has(path.extname(absolutePath));
}

function isTestFile(relativePath: string): boolean {
    return (
        relativePath.includes('/__tests__/') ||
        relativePath.endsWith('.test.ts') ||
        relativePath.endsWith('.test.tsx') ||
        relativePath.endsWith('.test.js') ||
        relativePath.endsWith('.test.jsx') ||
        relativePath.endsWith('.spec.ts') ||
        relativePath.endsWith('.spec.tsx') ||
        relativePath.endsWith('.spec.js') ||
        relativePath.endsWith('.spec.jsx')
    );
}

function isGeneratedSourceFile(relativePath: string, content: string): boolean {
    const fileName = path.basename(relativePath).toLowerCase();
    return (
        relativePath.includes('/__generated__/') ||
        relativePath.includes('/generated/') ||
        fileName.startsWith('generated') ||
        fileName.includes('.gen.') ||
        fileName.includes('.generated.') ||
        content.includes('@generated')
    );
}

function isParserSourceFile(relativePath: string): boolean {
    return relativePath.includes('/parsers/') || relativePath.includes('/parse/');
}

function isRendererSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('src/');
}

function isPreloadSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('electron/main/preload/');
}

function isElectronSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('electron/');
}

function collectSourceFiles(rootDir: string): AuditSourceFile[] {
    const files: AuditSourceFile[] = [];

    function walk(currentDirectory: string): void {
        for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (shouldSkipDirectory(entry.name)) {
                    continue;
                }

                walk(path.join(currentDirectory, entry.name));
                continue;
            }

            const absolutePath = path.join(currentDirectory, entry.name);
            if (!isSourceFile(absolutePath)) {
                continue;
            }

            const content = readFileSync(absolutePath, 'utf8');
            const relativePath = normalizeRelativePath(rootDir, absolutePath);
            const lineCount = content.length === 0 ? 0 : content.split(/\r?\n/).length;

            files.push({
                absolutePath,
                relativePath,
                content,
                lineCount,
            });
        }
    }

    for (const sourceRoot of SOURCE_ROOT_DIRECTORIES) {
        const sourceRootPath = path.join(rootDir, sourceRoot);
        try {
            walk(sourceRootPath);
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                continue;
            }

            throw error;
        }
    }
    return files;
}

function collectPatternViolations(input: {
    files: AuditSourceFile[];
    shouldInclude: (file: AuditSourceFile) => boolean;
    shouldIncludeLine?: (file: AuditSourceFile, lineContent: string) => boolean;
    pattern: RegExp | string;
    message: string;
}): AuditViolation[] {
    const violations: AuditViolation[] = [];

    for (const file of input.files) {
        if (!input.shouldInclude(file)) {
            continue;
        }

        const lines = file.content.split(/\r?\n/);
        lines.forEach((lineContent, index) => {
            if (input.shouldIncludeLine && !input.shouldIncludeLine(file, lineContent)) {
                return;
            }

            const matches =
                typeof input.pattern === 'string'
                    ? lineContent.includes(input.pattern)
                    : (() => {
                          input.pattern.lastIndex = 0;
                          return input.pattern.test(lineContent);
                      })();

            if (matches) {
                violations.push({
                    path: file.relativePath,
                    line: index + 1,
                    message: input.message,
                });
            }
        });
    }

    return violations;
}

function isImportAliasLine(lineContent: string): boolean {
    return /^\s*[A-Za-z0-9_$]+\s+as\s+[A-Za-z0-9_$]+\s*,?\s*$/.test(lineContent);
}

function isIntentionalThrowLine(relativePath: string, lineContent: string): boolean {
    const trimmedLine = lineContent.trim();
    if (
        trimmedLine.startsWith('throw new InvariantError(') ||
        trimmedLine.startsWith('throw new DataCorruptionError(')
    ) {
        return true;
    }

    if (trimmedLine === 'throw error;' || trimmedLine === 'throw normalizedError;') {
        return true;
    }

    if (
        relativePath === 'src/lib/privacy/privacyContext.tsx' ||
        relativePath === 'src/lib/theme/themeContext.tsx'
    ) {
        return trimmedLine.startsWith('throw new Error(');
    }

    if (relativePath === 'scripts/audit-agents-conformance.ts' || relativePath === 'scripts/doctor-desktop.ts') {
        return trimmedLine.startsWith('throw ');
    }

    if (relativePath === 'electron/backend/trpc/trpcErrorMap.ts') {
        return trimmedLine.startsWith('throw ');
    }

    if (relativePath.startsWith('electron/backend/trpc/routers/')) {
        return trimmedLine.includes('throw toTrpcError(');
    }

    return false;
}

function collectTestFrameworkImportViolations(files: AuditSourceFile[]): AuditViolation[] {
    return files.flatMap((file) => {
        if (isTestFile(file.relativePath) || isGeneratedSourceFile(file.relativePath, file.content)) {
            return [];
        }

        const lines = file.content.split(/\r?\n/);
        return lines.flatMap((lineContent, index) => {
            const importsTestFramework = TEST_FRAMEWORK_IMPORT_PATTERNS.some((pattern) => lineContent.includes(pattern));
            const importsTestsDirectory = lineContent.includes('__tests__');
            if (!importsTestFramework && !importsTestsDirectory) {
                return [];
            }

            return [
                {
                    path: file.relativePath,
                    line: index + 1,
                    message: 'Non-test source must not import test frameworks or __tests__ modules.',
                },
            ];
        });
    });
}

function isReactMemoizationLine(lineContent: string): boolean {
    return (
        lineContent.includes('useMemo(') ||
        lineContent.includes('useMemo<') ||
        lineContent.includes('useCallback(') ||
        lineContent.includes('useCallback<') ||
        lineContent.includes('memo(')
    );
}

function isForbiddenLayoutEffectLine(lineContent: string): boolean {
    return lineContent.includes('useLayoutEffect(') || lineContent.includes('useLayoutEffect<');
}

function collectRendererElectronImportViolations(files: AuditSourceFile[]): AuditViolation[] {
    return collectPatternViolations({
        files,
        shouldInclude: (file) => !isTestFile(file.relativePath) && isRendererSourceFile(file.relativePath),
        pattern: /from\s+['"]electron['"]/,
        message: 'Renderer source must not import from electron directly; route access through preload or shared contracts.',
    });
}

function collectNonPreloadElectronBridgeViolations(files: AuditSourceFile[]): AuditViolation[] {
    const violations: AuditViolation[] = [];

    for (const file of files) {
        if (
            isTestFile(file.relativePath) ||
            isPreloadSourceFile(file.relativePath) ||
            (!isRendererSourceFile(file.relativePath) && !isElectronSourceFile(file.relativePath))
        ) {
            continue;
        }

        const lines = file.content.split(/\r?\n/);
        const lineIndex = lines.findIndex((lineContent) => {
            const trimmedLine = lineContent.trimStart();
            return !trimmedLine.startsWith('//') && /\b(?:ipcRenderer|contextBridge)\b/.test(lineContent);
        });

        if (lineIndex === -1) {
            continue;
        }

        violations.push({
            path: file.relativePath,
            line: lineIndex + 1,
            message: 'ipcRenderer and contextBridge are preload-only APIs.',
        });
    }

    return violations;
}

function countOccurrences(value: string, pattern: RegExp): number {
    const matches = value.match(pattern);
    return matches ? matches.length : 0;
}

function collectBrowserWindowSegments(file: AuditSourceFile): Array<{ line: number; content: string }> {
    const lines = file.content.split(/\r?\n/);
    const segments: Array<{ line: number; content: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
        const lineContent = lines[index] ?? '';
        if (!lineContent.includes('new BrowserWindow(')) {
            continue;
        }

        let braceDepth = 0;
        let startedObject = false;
        const segmentLines: string[] = [];
        const startLine = index + 1;

        for (let cursor = index; cursor < lines.length; cursor += 1) {
            const currentLine = lines[cursor] ?? '';
            segmentLines.push(currentLine);
            braceDepth += countOccurrences(currentLine, /\{/g);
            braceDepth -= countOccurrences(currentLine, /\}/g);
            if (currentLine.includes('{')) {
                startedObject = true;
            }

            if (startedObject && braceDepth <= 0) {
                index = cursor;
                break;
            }
        }

        segments.push({
            line: startLine,
            content: segmentLines.join('\n'),
        });
    }

    return segments;
}

function collectInsecureBrowserWindowViolations(files: AuditSourceFile[]): AuditViolation[] {
    const violations: AuditViolation[] = [];

    for (const file of files) {
        if (isTestFile(file.relativePath) || !isElectronSourceFile(file.relativePath)) {
            continue;
        }

        for (const segment of collectBrowserWindowSegments(file)) {
            const missingFlags: string[] = [];
            if (!segment.content.includes('contextIsolation: true')) {
                missingFlags.push('contextIsolation: true');
            }
            if (!segment.content.includes('nodeIntegration: false')) {
                missingFlags.push('nodeIntegration: false');
            }
            if (!segment.content.includes('sandbox: true')) {
                missingFlags.push('sandbox: true');
            }

            if (missingFlags.length === 0) {
                continue;
            }

            violations.push({
                path: file.relativePath,
                line: segment.line,
                message: `BrowserWindow must keep hardened webPreferences: missing or insecure ${missingFlags.join(', ')}.`,
            });
        }
    }

    return violations;
}

function collectAsyncEffectViolations(files: AuditSourceFile[]): AuditViolation[] {
    return collectPatternViolations({
        files,
        shouldInclude: (file) => !isTestFile(file.relativePath) && isRendererSourceFile(file.relativePath),
        pattern: /useEffect\s*\(\s*async\b/,
        message: 'Do not write useEffect(async () => ...); keep the effect synchronous and call an inner async function.',
    });
}

function collectSuspiciousEffectViolations(files: AuditSourceFile[]): AuditViolation[] {
    const violations: AuditViolation[] = [];
    const setterPattern =
        /\b(?:set[A-Z][A-Za-z0-9_]*|input\.uiState\.set[A-Z][A-Za-z0-9_]*|uiState\.set[A-Z][A-Za-z0-9_]*)\s*\(/;
    const externalSyncPattern =
        /\b(?:addEventListener|removeEventListener|subscribe|unsubscribe|localStorage|sessionStorage|matchMedia|persist[A-Z]|prefetch|invalidate|setConnecting|setError|sendRendererReadySignal)\b/;
    const remoteMirrorPattern =
        /\b(?:[A-Za-z0-9_]+Query\.data\?\.(?:settings|profiles|profile|state)|selected[A-Z][A-Za-z0-9_]*|active[A-Z][A-Za-z0-9_]*|workspaceScope|firstSelectable[A-Z][A-Za-z0-9_]*|initial[A-Z][A-Za-z0-9_]*|default[A-Z][A-Za-z0-9_]*|input\.preference|input\.threads|input\.tags|input\.buckets|input\.selectedProviderId|input\.selectedModelId|resolvedProfileId|defaults\b|models\b|workspaceRoots\b)\b/;
    const allowedDialogLifecyclePattern =
        /\bif\s*\(!open\)\s*\{\s*return;\s*\}[\s\S]*\b(?:initialText|preferredResolution|forcedMode)\b/;
    const effectPattern = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[\s\S]*?\]\s*\)/g;

    for (const file of files) {
        if (isTestFile(file.relativePath) || !isRendererSourceFile(file.relativePath)) {
            continue;
        }

        let match: RegExpExecArray | null;
        while ((match = effectPattern.exec(file.content)) !== null) {
            const body = match[1] ?? '';
            if (!setterPattern.test(body)) {
                continue;
            }
            if (/\breturn\s*\(\s*\)\s*=>/.test(body)) {
                continue;
            }
            if (externalSyncPattern.test(body)) {
                continue;
            }
            if (allowedDialogLifecyclePattern.test(body)) {
                continue;
            }
            if (!remoteMirrorPattern.test(body)) {
                continue;
            }

            const line = file.content.slice(0, match.index).split(/\r?\n/).length;
            violations.push({
                path: file.relativePath,
                line,
                message: 'Review effect-driven state mirroring and replace it with derived state, a keyed draft reset, or an explicit reconciliation boundary.',
            });
        }
    }

    return violations;
}

export function auditAgentsConformance(rootDir: string): AgentsConformanceReport {
    const sourceFiles = collectSourceFiles(rootDir);

    return {
        oversizedHandwrittenSourceFiles: sourceFiles
            .filter((file) => file.lineCount > MAX_SOURCE_LINES)
            .map((file) => ({
                path: file.relativePath,
                line: file.lineCount,
                message: `Source file exceeds ${String(MAX_SOURCE_LINES)} lines.`,
            })),
        inlineLintSuppressions: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) => !isGeneratedSourceFile(file.relativePath, file.content),
            pattern: INLINE_LINT_SUPPRESSION_PATTERN,
            message: 'Inline lint suppressions are not allowed in handwritten source.',
        }),
        nonTestFrameworkImports: collectTestFrameworkImportViolations(sourceFiles),
        forbiddenLayoutEffects: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) => !isTestFile(file.relativePath) && isRendererSourceFile(file.relativePath),
            pattern: 'useLayoutEffect',
            shouldIncludeLine: (_file, lineContent) => isForbiddenLayoutEffectLine(lineContent),
            message: 'useLayoutEffect is not allowed unless the file is explicitly allowlisted for a proven pre-paint layout need.',
        }),
        rendererElectronImports: collectRendererElectronImportViolations(sourceFiles),
        nonPreloadElectronBridgeUsage: collectNonPreloadElectronBridgeViolations(sourceFiles),
        insecureBrowserWindows: collectInsecureBrowserWindowViolations(sourceFiles),
        nonBlockingReactMemoization: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) => !isTestFile(file.relativePath) && isRendererSourceFile(file.relativePath),
            pattern: 'useMemo',
            shouldIncludeLine: (_file, lineContent) => isReactMemoizationLine(lineContent),
            message: 'Review defensive React memoization and remove it unless compiler coverage is known to miss.',
        }),
        nonBlockingSuspiciousEffects: collectSuspiciousEffectViolations(sourceFiles),
        nonBlockingAsyncEffects: collectAsyncEffectViolations(sourceFiles),
        nonBlockingBroadCasts: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) => !isTestFile(file.relativePath),
            shouldIncludeLine: (_file, lineContent) => {
                const trimmedLine = lineContent.trimStart();
                return (
                    !trimmedLine.startsWith('import ') &&
                    !trimmedLine.startsWith('export {') &&
                    !isImportAliasLine(lineContent)
                );
            },
            pattern: BROAD_CAST_PATTERN,
            message: 'Review broad type cast and replace it with a validated boundary where possible.',
        }),
        nonBlockingThrows: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) =>
                !isTestFile(file.relativePath) &&
                !isParserSourceFile(file.relativePath) &&
                file.relativePath !== 'scripts/audit-agents-conformance.ts',
            shouldIncludeLine: (file, lineContent) => !isIntentionalThrowLine(file.relativePath, lineContent),
            pattern: /\bthrow\b/,
            message: 'Review non-parser throw and confirm it is an invariant, data-corruption, or impossible-readback case.',
        }),
    };
}

function logViolations(label: string, violations: AuditViolation[], level: 'info' | 'warn' | 'error'): void {
    if (violations.length === 0) {
        scriptLog.info({
            tag: 'agents.audit',
            message: `${label}: none found.`,
        });
        return;
    }

    scriptLog[level]({
        tag: 'agents.audit',
        message: `${label}: ${String(violations.length)} issue(s).`,
        violations,
    });
}

export function hasBlockingViolations(report: AgentsConformanceReport): boolean {
    return (
        report.oversizedHandwrittenSourceFiles.length > 0 ||
        report.inlineLintSuppressions.length > 0 ||
        report.nonTestFrameworkImports.length > 0 ||
        report.forbiddenLayoutEffects.length > 0 ||
        report.rendererElectronImports.length > 0 ||
        report.nonPreloadElectronBridgeUsage.length > 0 ||
        report.insecureBrowserWindows.length > 0
    );
}

export function runAgentsConformanceAudit(options: {
    rootDir?: string;
    reportOnly?: boolean;
} = {}): AgentsConformanceReport {
    const rootDir = options.rootDir ?? process.cwd();
    const report = auditAgentsConformance(rootDir);

    logViolations('Oversized source files', report.oversizedHandwrittenSourceFiles, 'error');
    logViolations('Inline lint suppressions', report.inlineLintSuppressions, 'error');
    logViolations('Non-test framework imports', report.nonTestFrameworkImports, 'error');
    logViolations('Forbidden useLayoutEffect review', report.forbiddenLayoutEffects, 'error');
    logViolations('Renderer electron import violations', report.rendererElectronImports, 'error');
    logViolations('Non-preload Electron bridge usage', report.nonPreloadElectronBridgeUsage, 'error');
    logViolations('BrowserWindow hardening violations', report.insecureBrowserWindows, 'error');
    logViolations('React memoization review', report.nonBlockingReactMemoization, 'warn');
    logViolations('Suspicious effect review', report.nonBlockingSuspiciousEffects, 'warn');
    logViolations('Async effect review', report.nonBlockingAsyncEffects, 'warn');
    logViolations('Broad cast review', report.nonBlockingBroadCasts, 'warn');
    logViolations('Non-parser throw review', report.nonBlockingThrows, 'warn');

    const blockingViolations = hasBlockingViolations(report);
    scriptLog.info({
        tag: 'agents.audit',
        message: 'AGENTS conformance audit completed.',
        rootDir,
        blockingViolations,
        reportOnly: options.reportOnly ?? false,
    });

    if (blockingViolations && !options.reportOnly) {
        throw new Error('AGENTS conformance audit failed.');
    }

    return report;
}

function isDirectExecution(importMetaUrl: string): boolean {
    const entryPath = process.argv[1];
    if (!entryPath) {
        return false;
    }

    return importMetaUrl === pathToFileURL(path.resolve(entryPath)).href;
}

if (isDirectExecution(import.meta.url)) {
    runAgentsConformanceAudit({
        reportOnly: process.argv.includes('--report'),
    });
}
