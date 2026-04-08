import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
    type WorkspaceEnvironmentMarkers,
    type WorkspaceProjectNodeExpectation,
} from '@/app/backend/runtime/contracts/types/runtime';
import { normalizeWorkspacePath } from '@/app/backend/runtime/services/environment/workspaceEnvironmentPathUtils';

import { coerce, satisfies, validRange } from 'semver';

function isNodeWorkspace(markers: WorkspaceEnvironmentMarkers): boolean {
    return markers.hasPackageJson || markers.hasTsconfigJson;
}

function parseSimpleVersionLikeValue(
    rawValue: string,
    source: Extract<WorkspaceProjectNodeExpectation['source'], 'nvmrc' | 'node_version_file'>,
    vendoredNodeVersion: string
): WorkspaceProjectNodeExpectation | null {
    const normalized = rawValue.trim().replace(/^v/u, '');
    if (!/^\d+(?:\.\d+(?:\.\d+)?)?$/u.test(normalized)) {
        return null;
    }

    const coerced = coerce(normalized);
    if (!coerced) {
        return null;
    }

    const satisfiesRange =
        /^\d+$/u.test(normalized)
            ? `${normalized}.x`
            : /^\d+\.\d+$/u.test(normalized)
              ? `${normalized}.x`
              : normalized;

    return {
        source,
        rawValue,
        detectedMajor: coerced.major,
        satisfiesVendoredNode: satisfies(vendoredNodeVersion, satisfiesRange),
    };
}

async function readOptionalTextFile(targetPath: string): Promise<string | null> {
    try {
        const content = await readFile(targetPath, 'utf8');
        return content.trim();
    } catch {
        return null;
    }
}

function readFirstMeaningfulLine(content: string): string | null {
    const line = content
        .split(/\r?\n/u)
        .map((candidate) => candidate.trim())
        .find((candidate) => candidate.length > 0 && !candidate.startsWith('#'));

    return line ?? null;
}

export class ProjectNodeExpectationResolver {
    async resolve(input: {
        workspaceRootPath: string;
        markers: WorkspaceEnvironmentMarkers;
        vendoredNodeVersion: string;
    }): Promise<WorkspaceProjectNodeExpectation | undefined> {
        const workspaceRootPath = normalizeWorkspacePath(input.workspaceRootPath);

        if (input.markers.hasPackageJson) {
            const packageJsonText = await readOptionalTextFile(path.join(workspaceRootPath, 'package.json'));
            if (packageJsonText) {
                try {
                    const parsed = JSON.parse(packageJsonText) as { engines?: { node?: unknown } };
                    const engineValue = parsed.engines?.node;
                    if (typeof engineValue === 'string') {
                        const rawValue = engineValue.trim();
                        const range = validRange(rawValue);
                        if (range) {
                            const coerced = coerce(rawValue);
                            return {
                                source: 'package_json_engines',
                                rawValue,
                                ...(coerced ? { detectedMajor: coerced.major } : {}),
                                satisfiesVendoredNode: satisfies(input.vendoredNodeVersion, range),
                            };
                        }
                    }
                } catch {
                    // Fail closed and continue to lower-precedence signals.
                }
            }
        }

        const nvmrcText = await readOptionalTextFile(path.join(workspaceRootPath, '.nvmrc'));
        if (nvmrcText) {
            const value = readFirstMeaningfulLine(nvmrcText);
            if (value) {
                const parsed = parseSimpleVersionLikeValue(value, 'nvmrc', input.vendoredNodeVersion);
                if (parsed) {
                    return parsed;
                }
            }
        }

        const nodeVersionText = await readOptionalTextFile(path.join(workspaceRootPath, '.node-version'));
        if (nodeVersionText) {
            const value = readFirstMeaningfulLine(nodeVersionText);
            if (value) {
                const parsed = parseSimpleVersionLikeValue(value, 'node_version_file', input.vendoredNodeVersion);
                if (parsed) {
                    return parsed;
                }
            }
        }

        if (isNodeWorkspace(input.markers)) {
            return {
                source: 'node_workspace_heuristic',
            };
        }

        return undefined;
    }
}

export const projectNodeExpectationResolver = new ProjectNodeExpectationResolver();
