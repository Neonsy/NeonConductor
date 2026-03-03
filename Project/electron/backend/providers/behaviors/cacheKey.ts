import { createHash } from 'node:crypto';

interface BuildAutoCacheKeyInput {
    profileId: string;
    sessionId: string;
    providerId: string;
    modelId: string;
}

export function buildAutoCacheKey(input: BuildAutoCacheKeyInput): string {
    const hash = createHash('sha256');
    hash.update(input.profileId);
    hash.update('|');
    hash.update(input.sessionId);
    hash.update('|');
    hash.update(input.providerId);
    hash.update('|');
    hash.update(input.modelId);

    return `nc-auto-${hash.digest('hex').slice(0, 32)}`;
}
