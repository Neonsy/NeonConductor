import path from 'node:path';

export interface ResolvedWorkspacePath {
    absolutePath: string;
    workspaceRootPath: string;
}

const IGNORED_SEGMENTS = new Set(['.git', '.jj', 'node_modules']);

export function resolveWorkspaceToolPath(input: {
    workspaceRootPath: string;
    targetPath?: string;
}): ResolvedWorkspacePath {
    const workspaceRootPath = path.resolve(input.workspaceRootPath);
    const targetPath = input.targetPath?.trim();

    if (!targetPath) {
        return {
            absolutePath: workspaceRootPath,
            workspaceRootPath,
        };
    }

    const absolutePath = path.isAbsolute(targetPath)
        ? path.normalize(targetPath)
        : path.resolve(workspaceRootPath, targetPath);

    return {
        absolutePath,
        workspaceRootPath,
    };
}

export function isPathInsideWorkspace(absolutePath: string, workspaceRootPath: string): boolean {
    const relative = path.relative(workspaceRootPath, absolutePath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function isIgnoredWorkspacePath(absolutePath: string, workspaceRootPath: string): boolean {
    const relative = path.relative(workspaceRootPath, absolutePath);
    if (relative === '') {
        return false;
    }

    const segments = relative.split(path.sep).filter((segment) => segment.length > 0);
    return segments.some((segment) => IGNORED_SEGMENTS.has(segment));
}
