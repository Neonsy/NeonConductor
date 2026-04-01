import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    spawn: spawnMock,
}));

import { WorkspaceShellResolver } from '@/app/backend/runtime/services/environment/workspaceShellResolver';

function queueLookupResponses(responses: Partial<Record<string, string>>) {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
        const child = new EventEmitter() as EventEmitter & {
            stdout: PassThrough;
            stderr: PassThrough;
        };
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();

        process.nextTick(() => {
            const candidate = args[0] ?? '';
            const resolvedPath = responses[candidate];
            if (resolvedPath) {
                child.stdout.write(`${resolvedPath}\n`);
                child.stdout.end();
                child.emit('close', 0);
                return;
            }

            child.stdout.end();
            child.emit('close', 1);
        });

        return child;
    });
}

describe('workspaceShellResolver', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
        spawnMock.mockReset();
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            configurable: true,
        });
    });

    it('prefers pwsh.exe on Windows when both PowerShell executables are available', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
            configurable: true,
        });
        queueLookupResponses({
            'pwsh.exe': 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
            'powershell.exe': 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        });

        const resolver = new WorkspaceShellResolver();
        const resolvedShell = await resolver.resolve('win32');

        expect(resolvedShell).toEqual({
            shellFamily: 'powershell',
            shellExecutable: 'pwsh.exe',
            spawnFile: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
            resolved: true,
        });
    });

    it('falls back to powershell.exe on Windows when pwsh.exe is unavailable', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
            configurable: true,
        });
        queueLookupResponses({
            'powershell.exe': 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        });

        const resolver = new WorkspaceShellResolver();
        const resolvedShell = await resolver.resolve('win32');

        expect(resolvedShell).toEqual({
            shellFamily: 'powershell',
            shellExecutable: 'powershell.exe',
            spawnFile: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            resolved: true,
        });
    });

    it('returns an unresolved PowerShell shell on Windows when no supported executable is available', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
            configurable: true,
        });
        queueLookupResponses({});

        const resolver = new WorkspaceShellResolver();
        const resolvedShell = await resolver.resolve('win32');

        expect(resolvedShell).toEqual({
            shellFamily: 'powershell',
            resolved: false,
        });
    });

    it('resolves /bin/sh on non-Windows platforms', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'linux',
            configurable: true,
        });

        const resolver = new WorkspaceShellResolver();
        const resolvedShell = await resolver.resolve('linux');

        expect(resolvedShell).toEqual({
            shellFamily: 'posix_sh',
            shellExecutable: '/bin/sh',
            spawnFile: '/bin/sh',
            resolved: true,
        });
    });
});
