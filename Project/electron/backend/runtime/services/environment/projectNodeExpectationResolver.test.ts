import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceEnvironmentMarkers } from '@/app/backend/runtime/contracts/types/runtime';
import { ProjectNodeExpectationResolver } from '@/app/backend/runtime/services/environment/projectNodeExpectationResolver';
import { VENDORED_NODE_VERSION } from '@/shared/tooling/vendoredNode';

function buildMarkers(input: Partial<WorkspaceEnvironmentMarkers>): WorkspaceEnvironmentMarkers {
    return {
        hasJjDirectory: input.hasJjDirectory ?? false,
        hasGitDirectory: input.hasGitDirectory ?? false,
        hasPackageJson: input.hasPackageJson ?? false,
        hasPnpmLock: input.hasPnpmLock ?? false,
        hasPackageLock: input.hasPackageLock ?? false,
        hasYarnLock: input.hasYarnLock ?? false,
        hasBunLock: input.hasBunLock ?? false,
        hasTsconfigJson: input.hasTsconfigJson ?? false,
        hasPyprojectToml: input.hasPyprojectToml ?? false,
        hasRequirementsTxt: input.hasRequirementsTxt ?? false,
    };
}

const tempDirs: string[] = [];

afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
        rmSync(tempDir, { recursive: true, force: true });
    }
});

describe('projectNodeExpectationResolver', () => {
    it('resolves root package.json engines.node and evaluates vendored satisfaction', async () => {
        const workspaceRootPath = mkdtempSync(path.join(os.tmpdir(), 'nc-node-expect-pkg-'));
        tempDirs.push(workspaceRootPath);
        writeFileSync(path.join(workspaceRootPath, 'package.json'), '{"engines":{"node":"^24"}}', 'utf8');

        const resolver = new ProjectNodeExpectationResolver();
        const resolved = await resolver.resolve({
            workspaceRootPath,
            markers: buildMarkers({ hasPackageJson: true }),
            vendoredNodeVersion: VENDORED_NODE_VERSION,
        });

        expect(resolved).toEqual({
            source: 'package_json_engines',
            rawValue: '^24',
            detectedMajor: 24,
            satisfiesVendoredNode: true,
        });
    });

    it('falls back to .nvmrc when package.json has no usable engines.node', async () => {
        const workspaceRootPath = mkdtempSync(path.join(os.tmpdir(), 'nc-node-expect-nvmrc-'));
        tempDirs.push(workspaceRootPath);
        writeFileSync(path.join(workspaceRootPath, 'package.json'), '{}', 'utf8');
        writeFileSync(path.join(workspaceRootPath, '.nvmrc'), '22\n', 'utf8');

        const resolver = new ProjectNodeExpectationResolver();
        const resolved = await resolver.resolve({
            workspaceRootPath,
            markers: buildMarkers({ hasPackageJson: true }),
            vendoredNodeVersion: VENDORED_NODE_VERSION,
        });

        expect(resolved).toEqual({
            source: 'nvmrc',
            rawValue: '22',
            detectedMajor: 22,
            satisfiesVendoredNode: false,
        });
    });

    it('falls back to .node-version when higher-precedence signals are absent', async () => {
        const workspaceRootPath = mkdtempSync(path.join(os.tmpdir(), 'nc-node-expect-node-version-'));
        tempDirs.push(workspaceRootPath);
        writeFileSync(path.join(workspaceRootPath, '.node-version'), '24.14.1\n', 'utf8');

        const resolver = new ProjectNodeExpectationResolver();
        const resolved = await resolver.resolve({
            workspaceRootPath,
            markers: buildMarkers({ hasTsconfigJson: true }),
            vendoredNodeVersion: VENDORED_NODE_VERSION,
        });

        expect(resolved).toEqual({
            source: 'node_version_file',
            rawValue: '24.14.1',
            detectedMajor: 24,
            satisfiesVendoredNode: true,
        });
    });

    it('fails closed to no explicit expectation when files are malformed', async () => {
        const workspaceRootPath = mkdtempSync(path.join(os.tmpdir(), 'nc-node-expect-malformed-'));
        tempDirs.push(workspaceRootPath);
        writeFileSync(path.join(workspaceRootPath, 'package.json'), '{not json', 'utf8');
        writeFileSync(path.join(workspaceRootPath, '.nvmrc'), 'lts/*\n', 'utf8');

        const resolver = new ProjectNodeExpectationResolver();
        const resolved = await resolver.resolve({
            workspaceRootPath,
            markers: buildMarkers({ hasPackageJson: true, hasTsconfigJson: true }),
            vendoredNodeVersion: VENDORED_NODE_VERSION,
        });

        expect(resolved).toEqual({
            source: 'node_workspace_heuristic',
        });
    });
});
