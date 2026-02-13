const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function isSafeExternalUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
    } catch {
        return false;
    }
}

export function isAppNavigation(rawUrl: string, devServerUrl?: string): boolean {
    try {
        const target = new URL(rawUrl);

        if (devServerUrl) {
            const dev = new URL(devServerUrl);
            return target.origin === dev.origin;
        }

        return target.protocol === 'file:';
    } catch {
        return false;
    }
}
