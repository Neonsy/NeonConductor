import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

import { isEntityId } from '@/shared/contracts';

function collectFiles(rootDirectory: string, extension: '.ts' | '.tsx'): string[] {
    const entries = readdirSync(rootDirectory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const absolutePath = path.join(rootDirectory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(absolutePath, extension));
            continue;
        }

        if (absolutePath.endsWith(extension)) {
            files.push(absolutePath);
        }
    }

    return files;
}

function collectTypeScriptFiles(rootDirectory: string): string[] {
    return [...collectFiles(rootDirectory, '.ts'), ...collectFiles(rootDirectory, '.tsx')];
}

function toWorkspaceRelativePath(absolutePath: string): string {
    return path.relative(path.resolve(import.meta.dirname, '..', '..'), absolutePath).replaceAll('\\', '/');
}

describe('shared runtime contracts boundary', () => {
    it('keeps shared contracts free of node builtin imports', () => {
        const sharedContractsRoot = path.resolve(import.meta.dirname, '..', '..', 'electron', 'shared', 'contracts');
        const contractFiles = collectTypeScriptFiles(sharedContractsRoot);

        const filesWithNodeImports = contractFiles.flatMap((filePath) => {
            const fileContent = readFileSync(filePath, 'utf8');
            return /from ['"]node:/.test(fileContent) ? [toWorkspaceRelativePath(filePath)] : [];
        });

        expect(filesWithNodeImports).toEqual([]);
    });

    it('keeps renderer source off the backend runtime contracts barrel', () => {
        const rendererRoot = path.resolve(import.meta.dirname, '..', '..', 'src');
        const rendererFiles = collectTypeScriptFiles(rendererRoot);

        const backendContractImports = rendererFiles.flatMap((filePath) => {
            const fileContent = readFileSync(filePath, 'utf8');
            return /@\/app\/backend\/runtime\/contracts/.test(fileContent) ? [toWorkspaceRelativePath(filePath)] : [];
        });

        expect(backendContractImports).toEqual([]);
    });

    it('keeps backend-only id generation separate from shared id guards', () => {
        const entityId = createEntityId('sess');

        expect(isEntityId(entityId, 'sess')).toBe(true);
        expect(entityId.startsWith('sess_')).toBe(true);
    });
});
