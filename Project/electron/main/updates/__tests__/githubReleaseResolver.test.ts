import { describe, expect, it, vi } from 'vitest';

import {
    GitHubReleaseResolverError,
    resolveLatestReleaseForChannel,
    type ResolveLatestReleaseOptions,
} from '@/app/main/updates/githubReleaseResolver';

interface MockRelease {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
}

function createOptions(
    releases: MockRelease[],
    status = 200,
    headers: Record<string, string> = {}
): ResolveLatestReleaseOptions {
    return {
        owner: 'Neonsy',
        repo: 'NeonConductor',
        fetchImpl: vi.fn(() =>
            Promise.resolve(
                new Response(JSON.stringify(releases), {
                    status,
                    headers,
                })
            )
        ),
    };
}

describe('resolveLatestReleaseForChannel', () => {
    it('picks highest alpha tag among non-draft releases', async () => {
        const result = await resolveLatestReleaseForChannel(
            'alpha',
            createOptions([
                { tag_name: 'v1.2.0-alpha.1', draft: false, prerelease: true },
                { tag_name: 'v1.2.0-alpha.9', draft: false, prerelease: true },
                { tag_name: 'v1.3.0-alpha.2', draft: false, prerelease: true },
                { tag_name: 'v1.4.0-alpha.1', draft: true, prerelease: true },
            ])
        );

        expect(result.tag).toBe('v1.3.0-alpha.2');
        expect(result.feedBaseUrl).toContain('/releases/download/v1.3.0-alpha.2/');
    });

    it('picks highest beta tag among mixed channel releases', async () => {
        const result = await resolveLatestReleaseForChannel(
            'beta',
            createOptions([
                { tag_name: 'v1.1.0-alpha.8', draft: false, prerelease: true },
                { tag_name: 'v1.1.0-beta.1', draft: false, prerelease: true },
                { tag_name: 'v1.1.0-beta.7', draft: false, prerelease: true },
                { tag_name: 'v1.1.0', draft: false, prerelease: false },
            ])
        );

        expect(result.tag).toBe('v1.1.0-beta.7');
        expect(result.feedBaseUrl).toContain('/releases/download/v1.1.0-beta.7/');
    });

    it('picks highest stable tag and excludes prerelease-marked stable tags', async () => {
        const result = await resolveLatestReleaseForChannel(
            'stable',
            createOptions([
                { tag_name: 'v2.0.0', draft: false, prerelease: false },
                { tag_name: 'v2.1.0', draft: false, prerelease: true },
                { tag_name: 'v2.0.1', draft: false, prerelease: false },
            ])
        );

        expect(result.tag).toBe('v2.0.1');
        expect(result.feedBaseUrl).toContain('/releases/download/v2.0.1/');
    });

    it('throws not_found when no matching releases exist', async () => {
        await expect(
            resolveLatestReleaseForChannel(
                'alpha',
                createOptions([{ tag_name: 'v1.0.0-beta.1', draft: false, prerelease: true }])
            )
        ).rejects.toMatchObject({
            code: 'not_found',
        });
    });

    it('throws rate_limited for GitHub 403 with exhausted limit', async () => {
        await expect(
            resolveLatestReleaseForChannel('beta', createOptions([], 403, { 'x-ratelimit-remaining': '0' }))
        ).rejects.toBeInstanceOf(GitHubReleaseResolverError);

        await expect(
            resolveLatestReleaseForChannel('beta', createOptions([], 403, { 'x-ratelimit-remaining': '0' }))
        ).rejects.toMatchObject({
            code: 'rate_limited',
            statusCode: 403,
        });
    });
});
