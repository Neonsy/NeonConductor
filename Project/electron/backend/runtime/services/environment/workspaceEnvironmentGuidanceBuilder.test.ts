import { describe, expect, it } from 'vitest';

import type { WorkspaceEnvironmentSnapshot } from '@/app/backend/runtime/contracts/types/runtime';
import { buildWorkspaceEnvironmentGuidance } from '@/app/backend/runtime/services/environment/workspaceEnvironmentGuidanceBuilder';
import { VENDORED_NODE_VERSION } from '@/shared/tooling/vendoredNode';

function buildSnapshot(overrides: Partial<WorkspaceEnvironmentSnapshot>): WorkspaceEnvironmentSnapshot {
    return {
        platform: 'win32',
        shellFamily: 'powershell',
        shellExecutable: 'pwsh.exe',
        workspaceRootPath: 'C:\\Repo',
        markers: {
            hasJjDirectory: false,
            hasGitDirectory: true,
            hasPackageJson: true,
            hasPnpmLock: true,
            hasPackageLock: false,
            hasYarnLock: false,
            hasBunLock: false,
            hasTsconfigJson: true,
            hasPyprojectToml: false,
            hasRequirementsTxt: false,
        },
        availableCommands: {
            jj: { available: false },
            git: { available: true, executablePath: 'C:\\git.exe' },
            node: { available: true, executablePath: 'C:\\node.exe' },
            python: { available: false },
            python3: { available: false },
            pnpm: { available: true, executablePath: 'C:\\pnpm.cmd' },
            npm: { available: true, executablePath: 'C:\\npm.cmd' },
            yarn: { available: false },
            bun: { available: false },
            tsx: { available: true, executablePath: 'C:\\tsx.cmd' },
        },
        detectedPreferences: {
            vcs: 'git',
            packageManager: 'pnpm',
            runtime: 'node',
            scriptRunner: 'tsx',
        },
        effectivePreferences: {
            vcs: {
                family: 'git',
                source: 'detected',
                requestedOverride: 'auto',
                available: true,
                mismatch: false,
            },
            packageManager: {
                family: 'pnpm',
                source: 'detected',
                requestedOverride: 'auto',
                available: true,
                mismatch: false,
            },
            runtime: 'node',
            scriptRunner: 'tsx',
        },
        overrides: {
            preferredVcs: 'auto',
            preferredPackageManager: 'auto',
        },
        vendoredNode: {
            version: VENDORED_NODE_VERSION,
            available: true,
            targetKey: 'win32-x64',
            executablePath: 'C:\\Repo\\vendor\\node\\win32-x64\\node.exe',
        },
        notes: [],
        ...overrides,
    };
}

describe('workspaceEnvironmentGuidanceBuilder', () => {
    it('includes shell executable and rg/search guidance when vendored ripgrep is available', () => {
        const guidance = buildWorkspaceEnvironmentGuidance(buildSnapshot({}), {
            vendoredRipgrepAvailable: true,
        });

        expect(guidance).toContain('Shell family: powershell. Shell executable: pwsh.exe.');
        expect(guidance).toContain('prefer the native search_files tool');
        expect(guidance).toContain('prefer rg and rg --files');
    });

    it('describes unresolved Windows shells explicitly', () => {
        const snapshot = buildSnapshot({
            shellFamily: 'cmd',
        });
        const { shellExecutable: _shellExecutable, ...unresolvedSnapshot } = snapshot;
        const guidance = buildWorkspaceEnvironmentGuidance(unresolvedSnapshot);

        expect(guidance).toContain('Windows shell could not be resolved.');
    });
});
