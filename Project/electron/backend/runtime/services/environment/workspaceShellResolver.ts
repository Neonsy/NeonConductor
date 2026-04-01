import { spawn } from 'node:child_process';

import { resolveSupportedPlatform, resolveWorkspaceShellFamily } from '@/app/backend/runtime/services/environment/workspaceCommandAvailabilityService';
import type { SupportedPlatform } from '@/app/backend/runtime/services/environment/workspaceEnvironment.types';

const SHELL_LOOKUP_CACHE_TTL_MS = 5_000;

export interface ResolvedWorkspaceShell {
    shellFamily: 'powershell' | 'posix_sh';
    shellExecutable?: string;
    spawnFile?: string;
    resolved: boolean;
}

interface ShellLookupCacheEntry {
    expiresAt: number;
    shell: ResolvedWorkspaceShell;
}

async function lookupExecutablePath(input: {
    candidate: string;
    platform: SupportedPlatform;
}): Promise<string | undefined> {
    const lookupCommand = input.platform === 'win32' ? 'where.exe' : 'which';

    return await new Promise((resolve) => {
        const child = spawn(lookupCommand, [input.candidate], {
            windowsHide: true,
        });

        let stdout = '';

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        });

        child.on('error', () => {
            resolve(undefined);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                resolve(undefined);
                return;
            }

            const executablePath = stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find((line) => line.length > 0);

            resolve(executablePath);
        });
    });
}

function createCacheKey(platform: SupportedPlatform): string {
    return `${platform}::${process.env.PATH ?? ''}`;
}

export class WorkspaceShellResolver {
    private readonly cache = new Map<string, ShellLookupCacheEntry>();

    clearCache(): void {
        this.cache.clear();
    }

    async resolve(platform: SupportedPlatform = resolveSupportedPlatform()): Promise<ResolvedWorkspaceShell> {
        if (platform !== 'win32') {
            return {
                shellFamily: resolveWorkspaceShellFamily(platform),
                shellExecutable: '/bin/sh',
                spawnFile: '/bin/sh',
                resolved: true,
            };
        }

        const cacheKey = createCacheKey(platform);
        const now = Date.now();
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.shell;
        }

        const candidates = ['pwsh.exe', 'powershell.exe'] as const;
        for (const candidate of candidates) {
            const executablePath = await lookupExecutablePath({
                candidate,
                platform,
            });
            if (!executablePath) {
                continue;
            }

            const shell: ResolvedWorkspaceShell = {
                shellFamily: 'powershell',
                shellExecutable: candidate,
                spawnFile: executablePath,
                resolved: true,
            };
            this.cache.set(cacheKey, {
                expiresAt: now + SHELL_LOOKUP_CACHE_TTL_MS,
                shell,
            });
            return shell;
        }

        const unresolvedShell: ResolvedWorkspaceShell = {
            shellFamily: 'powershell',
            resolved: false,
        };
        this.cache.set(cacheKey, {
            expiresAt: now + SHELL_LOOKUP_CACHE_TTL_MS,
            shell: unresolvedShell,
        });
        return unresolvedShell;
    }
}

export const workspaceShellResolver = new WorkspaceShellResolver();
