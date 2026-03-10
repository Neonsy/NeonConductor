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
    nonBlockingReactMemoization: AuditViolation[];
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
        nonBlockingReactMemoization: collectPatternViolations({
            files: sourceFiles,
            shouldInclude: (file) => !isTestFile(file.relativePath) && isRendererSourceFile(file.relativePath),
            pattern: /\b(useMemo|useCallback|memo)\s*\(/,
            message: 'Review defensive React memoization and remove it unless compiler coverage is known to miss.',
        }),
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
        report.nonTestFrameworkImports.length > 0
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
    logViolations('React memoization review', report.nonBlockingReactMemoization, 'warn');
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
