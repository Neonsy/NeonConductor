import { EventEmitter } from 'node:events';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock, vendoredRipgrepResolverResolveMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
    vendoredRipgrepResolverResolveMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    spawn: spawnMock,
}));

vi.mock('@/app/backend/runtime/services/environment/vendoredRipgrepResolver', () => ({
    vendoredRipgrepResolver: {
        resolve: vendoredRipgrepResolverResolveMock,
    },
}));

import { searchFilesToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/searchFiles';

function createMockChildProcess() {
    const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn(() => {
        process.nextTick(() => {
            child.emit('close', null, 'SIGTERM');
        });
    });
    return child;
}

describe('searchFilesToolHandler', () => {
    beforeEach(() => {
        spawnMock.mockReset();
        vendoredRipgrepResolverResolveMock.mockReset();
    });

    it('returns structured fixed-string matches from ripgrep json output', async () => {
        vendoredRipgrepResolverResolveMock.mockResolvedValue({
            available: true,
            executablePath: 'C:/vendor/rg.exe',
        });
        spawnMock.mockImplementation(() => {
            const child = createMockChildProcess();
            process.nextTick(() => {
                child.stdout.write(
                    `${JSON.stringify({
                        type: 'match',
                        data: {
                            path: { text: 'C:/workspace/src/example.ts' },
                            lines: { text: 'const ExampleValue = value;\n' },
                            line_number: 12,
                            submatches: [{ start: 6, end: 13 }],
                        },
                    })}\n`
                );
                child.stdout.end();
                child.stderr.end();
                child.emit('close', 0, null);
            });
            return child;
        });

        const result = await searchFilesToolHandler({
            query: 'Example',
            path: 'C:/workspace',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        expect(result.value['searchedPath']).toBe(path.normalize('C:/workspace'));
        expect(result.value['matchCount']).toBe(1);
        expect(result.value['truncated']).toBe(false);
        expect(result.value['matches']).toEqual([
            {
                path: 'C:/workspace/src/example.ts',
                lineNumber: 12,
                columnNumber: 7,
                lineText: 'const ExampleValue = value;',
            },
        ]);
        expect(result.value['artifactCandidate']).toMatchObject({
            kind: 'search_results',
            contentType: 'text/plain',
        });
        expect(spawnMock).toHaveBeenCalledWith(
            'C:/vendor/rg.exe',
            expect.arrayContaining(['--json', '--fixed-strings', '--no-config', '--ignore-case', '--', 'Example']),
            expect.objectContaining({
                windowsHide: true,
            })
        );
    });

    it('enforces the hard match limit and marks results as truncated', async () => {
        vendoredRipgrepResolverResolveMock.mockResolvedValue({
            available: true,
            executablePath: '/vendor/rg',
        });
        const child = createMockChildProcess();
        spawnMock.mockReturnValue(child);

        const resultPromise = searchFilesToolHandler({
            query: 'value',
            path: '/workspace',
            maxMatches: 1,
        });

        process.nextTick(() => {
            child.stdout.write(
                `${JSON.stringify({
                    type: 'match',
                    data: {
                        path: { text: '/workspace/a.ts' },
                        lines: { text: 'value value\\n' },
                        line_number: 1,
                        submatches: [
                            { start: 0, end: 5 },
                            { start: 6, end: 11 },
                        ],
                    },
                })}\n`
            );
        });

        const result = await resultPromise;
        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        expect(result.value['matchCount']).toBe(1);
        expect(result.value['truncated']).toBe(true);
        expect(child.kill).toHaveBeenCalledTimes(1);
    });

    it('fails clearly when the vendored ripgrep binary is missing', async () => {
        vendoredRipgrepResolverResolveMock.mockResolvedValue({
            available: false,
            reason: 'missing_asset',
        });

        const result = await searchFilesToolHandler({
            query: 'value',
            path: '/workspace',
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected a failed result.');
        }

        expect(result.error).toEqual({
            code: 'execution_failed',
            message: 'The vendored ripgrep binary is missing. Run the ripgrep vendor step before using search_files.',
        });
    });
});
