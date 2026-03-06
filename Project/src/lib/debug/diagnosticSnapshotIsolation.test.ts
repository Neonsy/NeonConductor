import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function collectSourceFiles(root: string): string[] {
    const entries = readdirSync(root);
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(root, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (fullPath.includes(`${path.sep}debug`)) {
                continue;
            }
            files.push(...collectSourceFiles(fullPath));
            continue;
        }

        if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }

    return files;
}

describe('diagnostic snapshot isolation', () => {
    it('keeps diagnostic snapshot hook out of non-debug renderer paths', () => {
        const sourceRoot = path.resolve(process.cwd(), 'src');
        const sourceFiles = collectSourceFiles(sourceRoot);
        const importingFiles = sourceFiles.filter((filePath) =>
            readFileSync(filePath, 'utf8').includes('useDiagnosticRuntimeSnapshot')
        );

        expect(importingFiles).toEqual([]);
    });
});
