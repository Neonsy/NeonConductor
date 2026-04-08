export type VendoredNodeTargetKey = 'win32-x64' | 'darwin-x64' | 'darwin-arm64' | 'linux-x64';

export interface VendoredNodeTargetDefinition {
    targetKey: VendoredNodeTargetKey;
    platform: 'win32' | 'darwin' | 'linux';
    arch: 'x64' | 'arm64';
    archiveFileName: string;
    executableName: 'node' | 'node.exe';
    resourceRelativePath: string;
    downloadUrl: string;
}

export const VENDORED_NODE_VERSION = '24.14.1';
const RELEASE_BASE_URL = `https://nodejs.org/dist/v${VENDORED_NODE_VERSION}`;

export const vendoredNodeTargets: Record<VendoredNodeTargetKey, VendoredNodeTargetDefinition> = {
    'win32-x64': {
        targetKey: 'win32-x64',
        platform: 'win32',
        arch: 'x64',
        archiveFileName: `node-v${VENDORED_NODE_VERSION}-win-x64.zip`,
        executableName: 'node.exe',
        resourceRelativePath: 'vendor/node/win32-x64/node.exe',
        downloadUrl: `${RELEASE_BASE_URL}/node-v${VENDORED_NODE_VERSION}-win-x64.zip`,
    },
    'darwin-x64': {
        targetKey: 'darwin-x64',
        platform: 'darwin',
        arch: 'x64',
        archiveFileName: `node-v${VENDORED_NODE_VERSION}-darwin-x64.tar.gz`,
        executableName: 'node',
        resourceRelativePath: 'vendor/node/darwin-x64/node',
        downloadUrl: `${RELEASE_BASE_URL}/node-v${VENDORED_NODE_VERSION}-darwin-x64.tar.gz`,
    },
    'darwin-arm64': {
        targetKey: 'darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        archiveFileName: `node-v${VENDORED_NODE_VERSION}-darwin-arm64.tar.gz`,
        executableName: 'node',
        resourceRelativePath: 'vendor/node/darwin-arm64/node',
        downloadUrl: `${RELEASE_BASE_URL}/node-v${VENDORED_NODE_VERSION}-darwin-arm64.tar.gz`,
    },
    'linux-x64': {
        targetKey: 'linux-x64',
        platform: 'linux',
        arch: 'x64',
        archiveFileName: `node-v${VENDORED_NODE_VERSION}-linux-x64.tar.gz`,
        executableName: 'node',
        resourceRelativePath: 'vendor/node/linux-x64/node',
        downloadUrl: `${RELEASE_BASE_URL}/node-v${VENDORED_NODE_VERSION}-linux-x64.tar.gz`,
    },
} as const;

export function listVendoredNodeTargets(): VendoredNodeTargetDefinition[] {
    return Object.values(vendoredNodeTargets);
}

export function resolveVendoredNodeTargetKey(input: {
    platform: NodeJS.Platform;
    arch: string;
}): VendoredNodeTargetKey | null {
    if (input.platform === 'win32' && input.arch === 'x64') {
        return 'win32-x64';
    }

    if (input.platform === 'darwin' && input.arch === 'x64') {
        return 'darwin-x64';
    }

    if (input.platform === 'darwin' && input.arch === 'arm64') {
        return 'darwin-arm64';
    }

    if (input.platform === 'linux' && input.arch === 'x64') {
        return 'linux-x64';
    }

    return null;
}
