import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    spawn: spawnMock,
}));

import { runCommandToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/runCommand';
import { workspaceShellResolver } from '@/app/backend/runtime/services/environment/workspaceShellResolver';

function createSpawnedProcess(input?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
}) {
    const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        kill: () => void;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();

    process.nextTick(() => {
        if (input?.stdout) {
            child.stdout.write(input.stdout);
        }
        if (input?.stderr) {
            child.stderr.write(input.stderr);
        }
        child.stdout.end();
        child.stderr.end();
        child.emit('close', input?.exitCode ?? 0);
    });

    return child;
}

describe('runCommandToolHandler', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
        spawnMock.mockReset();
        workspaceShellResolver.clearCache();
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            configurable: true,
        });
    });

    it('uses pwsh.exe when the Windows shell resolver finds PowerShell 7 first', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
            configurable: true,
        });
        spawnMock
            .mockImplementationOnce((_file: string, args: string[]) => {
                expect(args).toEqual(['pwsh.exe']);
                return createSpawnedProcess({
                    stdout: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe\n',
                });
            })
            .mockImplementationOnce((file: string, args: string[]) => {
                expect(file).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe');
                expect(args).toEqual(['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'echo hi']);
                return createSpawnedProcess({
                    stdout: 'hi\n',
                });
            });

        const result = await runCommandToolHandler(
            {
                command: 'echo hi',
            },
            {
                cwd: 'C:\\Repo',
            }
        );

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.exitCode).toBe(0);
        expect(result.value.stdout).toContain('hi');
    });

    it('fails closed on Windows when no supported PowerShell executable is resolved', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
            configurable: true,
        });
        spawnMock
            .mockImplementationOnce(() => createSpawnedProcess({ exitCode: 1 }))
            .mockImplementationOnce(() => createSpawnedProcess({ exitCode: 1 }));

        const result = await runCommandToolHandler(
            {
                command: 'echo hi',
            },
            {
                cwd: 'C:\\Repo',
            }
        );

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected command execution to fail when no shell could be resolved.');
        }
        expect(result.error).toEqual({
            code: 'execution_failed',
            message: 'No supported shell executable could be resolved for command execution.',
        });
        expect(spawnMock).toHaveBeenCalledTimes(2);
    });
});
