export type VendoredRipgrepTargetKey = 'win32-x64' | 'darwin-x64' | 'darwin-arm64' | 'linux-x64';

export interface VendoredRipgrepTargetDefinition {
    targetKey: VendoredRipgrepTargetKey;
    platform: 'win32' | 'darwin' | 'linux';
    arch: 'x64' | 'arm64';
    archiveFileName: string;
    executableName: 'rg' | 'rg.exe';
    resourceRelativePath: string;
    downloadUrl: string;
}

export const VENDORED_RIPGREP_VERSION = '15.1.0';
const RELEASE_BASE_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${VENDORED_RIPGREP_VERSION}`;

export const vendoredRipgrepTargets: Record<VendoredRipgrepTargetKey, VendoredRipgrepTargetDefinition> = {
    'win32-x64': {
        targetKey: 'win32-x64',
        platform: 'win32',
        arch: 'x64',
        archiveFileName: `ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip`,
        executableName: 'rg.exe',
        resourceRelativePath: 'vendor/rg/win32-x64/rg.exe',
        downloadUrl: `${RELEASE_BASE_URL}/ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip`,
    },
    'darwin-x64': {
        targetKey: 'darwin-x64',
        platform: 'darwin',
        arch: 'x64',
        archiveFileName: `ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`,
        executableName: 'rg',
        resourceRelativePath: 'vendor/rg/darwin-x64/rg',
        downloadUrl: `${RELEASE_BASE_URL}/ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`,
    },
    'darwin-arm64': {
        targetKey: 'darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        archiveFileName: `ripgrep-${VENDORED_RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz`,
        executableName: 'rg',
        resourceRelativePath: 'vendor/rg/darwin-arm64/rg',
        downloadUrl: `${RELEASE_BASE_URL}/ripgrep-${VENDORED_RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz`,
    },
    'linux-x64': {
        targetKey: 'linux-x64',
        platform: 'linux',
        arch: 'x64',
        archiveFileName: `ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`,
        executableName: 'rg',
        resourceRelativePath: 'vendor/rg/linux-x64/rg',
        downloadUrl: `${RELEASE_BASE_URL}/ripgrep-${VENDORED_RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`,
    },
} as const;

export function listVendoredRipgrepTargets(): VendoredRipgrepTargetDefinition[] {
    return Object.values(vendoredRipgrepTargets);
}

export function resolveVendoredRipgrepTargetKey(input: {
    platform: NodeJS.Platform;
    arch: string;
}): VendoredRipgrepTargetKey | null {
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
