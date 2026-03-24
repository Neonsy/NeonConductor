import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { AuditSourceFile } from './types';

const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.turbo', 'release']);
const SOURCE_ROOT_DIRECTORIES = ['src', 'electron', 'scripts'];

function normalizeRelativePath(rootDir: string, absolutePath: string): string {
    return path.relative(rootDir, absolutePath).replaceAll('\\', '/');
}

function shouldSkipDirectory(name: string): boolean {
    return SKIPPED_DIRECTORIES.has(name);
}

function isSourceFile(absolutePath: string): boolean {
    return SOURCE_FILE_EXTENSIONS.has(path.extname(absolutePath));
}

export function isTestFile(relativePath: string): boolean {
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

export function isGeneratedSourceFile(relativePath: string, content: string): boolean {
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

export function isCanonicalAlphaBaselineMigration(relativePath: string): boolean {
    return relativePath === 'electron/backend/persistence/migrations/001_runtime_baseline.sql';
}

export function isSizeReviewException(relativePath: string, content: string): boolean {
    return isGeneratedSourceFile(relativePath, content) || isCanonicalAlphaBaselineMigration(relativePath);
}

export function isParserSourceFile(relativePath: string): boolean {
    return relativePath.includes('/parsers/') || relativePath.includes('/parse/');
}

export function isRendererSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('src/');
}

export function isPreloadSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('electron/main/preload/');
}

export function isElectronSourceFile(relativePath: string): boolean {
    return relativePath.startsWith('electron/');
}

export function collectSourceFiles(rootDir: string): AuditSourceFile[] {
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
