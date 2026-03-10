import path from 'node:path';

interface ResolveRuntimeAssetPathInput {
    isPackaged: boolean;
    appPath: string;
    relativePath: string;
    resourcesPath?: string;
}

export function resolveRuntimeAssetPath(input: ResolveRuntimeAssetPathInput): string {
    if (input.isPackaged) {
        return path.resolve(input.resourcesPath ?? process.resourcesPath, input.relativePath);
    }

    return path.resolve(input.appPath, input.relativePath);
}
