import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { VendoredNodeCodeRunner } from '@/app/backend/runtime/services/codeExecution/vendoredNodeCodeRunner';

import { VENDORED_NODE_VERSION } from '@/shared/tooling/vendoredNode';

const tempRoots: string[] = [];

afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

function createTempRoot(): string {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'neon-code-runner-test-'));
    tempRoots.push(tempRoot);
    return tempRoot;
}

function createRunner(input?: { tempRootPath?: string; available?: boolean }): VendoredNodeCodeRunner {
    return new VendoredNodeCodeRunner({
        tempRootPath: input?.tempRootPath ?? createTempRoot(),
        resolveVendoredNode: () =>
            Promise.resolve(
                input?.available === false
                    ? {
                          available: false,
                          reason: 'missing_asset',
                      }
                    : {
                          available: true,
                          targetKey: 'win32-x64',
                          executableName: 'node.exe',
                          executablePath: process.execPath,
                      }
            ),
    });
}

describe('VendoredNodeCodeRunner', () => {
    it('runs JavaScript transform code and captures console logs', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `
                console.log('hello', { "from": "execute_code" });
                return { value: 21 * 2 };
            `,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.runtime).toBe('vendored_node');
        expect(result.value.runtimeVersion).toBe(VENDORED_NODE_VERSION);
        expect(result.value.result).toEqual({ value: 42 });
        expect(result.value.logs).toEqual([
            {
                level: 'log',
                text: 'hello {"from":"execute_code"}',
                truncated: false,
            },
        ]);
        expect(result.value.error).toBeUndefined();
        expect(result.value.timedOut).toBe(false);
    });

    it('returns structured execution errors for thrown user-code failures', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `throw new Error('boom from user code');`,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.result).toBeNull();
        expect(result.value.error).toMatchObject({
            name: 'Error',
            message: 'boom from user code',
        });
    });

    it('returns structured execution errors for syntax failures', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `const = ;`,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.error?.name).toBe('SyntaxError');
    });

    it('marks CPU-bound executions as timed out', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `while (true) {}`,
            timeoutMs: 100,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.timedOut).toBe(true);
        expect(result.value.error?.message).toContain('timed out');
    });

    it('kills executions that leave the harness waiting on an unresolved promise', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `await new Promise(() => setInterval(() => undefined, 1000));`,
            timeoutMs: 100,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.timedOut).toBe(true);
        expect(result.value.error).toMatchObject({
            name: 'TimeoutError',
        });
    });

    it('truncates oversized results before returning them to the host', async () => {
        const runner = createRunner();

        const result = await runner.execute({
            code: `return 'x'.repeat(80_000);`,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.resultTruncated).toBe(true);
        expect(result.value.resultSerialization).toBe('json_preview');
        expect(result.value.resultBytes).toBeGreaterThan(64_000);
    });

    it('fails closed when the vendored Node runtime is unavailable', async () => {
        const runner = createRunner({ available: false });

        const result = await runner.execute({
            code: `return 1;`,
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected missing vendored Node to fail.');
        }
        expect(result.error).toEqual({
            code: 'execution_failed',
            message: 'Vendored Node runtime asset is missing.',
        });
    });

    it('cleans up temporary harness directories after execution', async () => {
        const tempRootPath = createTempRoot();
        const runner = createRunner({ tempRootPath });

        const result = await runner.execute({
            code: `return 'clean';`,
        });

        expect(result.isOk()).toBe(true);
        expect(readdirSync(tempRootPath)).toEqual([]);
    });
});
