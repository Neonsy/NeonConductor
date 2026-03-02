export type UpdateChannel = 'stable' | 'beta' | 'alpha';

export type GitHubReleaseResolverErrorCode = 'api_error' | 'rate_limited' | 'not_found' | 'invalid_response';

export interface ResolveLatestReleaseOptions {
    owner?: string;
    repo?: string;
    token?: string;
    fetchImpl?: typeof fetch;
}

export interface ResolvedChannelRelease {
    channel: UpdateChannel;
    tag: string;
    feedBaseUrl: string;
}

interface GitHubReleaseListItem {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
}

interface ParsedChannelVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease: number;
}

const DEFAULT_OWNER = 'Neonsy';
const DEFAULT_REPO = 'NeonConductor';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_WEB_BASE = 'https://github.com';

const STABLE_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;
const ALPHA_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)-alpha\.(\d+)$/;
const BETA_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;

export class GitHubReleaseResolverError extends Error {
    readonly code: GitHubReleaseResolverErrorCode;
    readonly statusCode: number | null;

    constructor(code: GitHubReleaseResolverErrorCode, message: string, statusCode?: number) {
        super(message);
        this.name = 'GitHubReleaseResolverError';
        this.code = code;
        this.statusCode = statusCode ?? null;
    }
}

function toRequestHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'NeonConductor-Updater',
    };

    if (token && token.length > 0) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

function parseTagForChannel(tag: string, channel: UpdateChannel): ParsedChannelVersion | null {
    const pattern =
        channel === 'stable' ? STABLE_TAG_PATTERN : channel === 'alpha' ? ALPHA_TAG_PATTERN : BETA_TAG_PATTERN;
    const match = pattern.exec(tag);

    if (!match) {
        return null;
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    const prerelease = channel === 'stable' ? 0 : Number(match[4]);

    if ([major, minor, patch, prerelease].some((part) => !Number.isInteger(part) || part < 0)) {
        return null;
    }

    return { major, minor, patch, prerelease };
}

function compareVersions(a: ParsedChannelVersion, b: ParsedChannelVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    return a.prerelease - b.prerelease;
}

function selectMatchingRelease(
    releases: GitHubReleaseListItem[],
    channel: UpdateChannel
): { tag: string; version: ParsedChannelVersion } | null {
    let selected: { tag: string; version: ParsedChannelVersion } | null = null;

    for (const release of releases) {
        if (release.draft) {
            continue;
        }

        if (channel === 'stable' && release.prerelease) {
            continue;
        }

        const parsedVersion = parseTagForChannel(release.tag_name, channel);
        if (!parsedVersion) {
            continue;
        }

        if (!selected || compareVersions(parsedVersion, selected.version) > 0) {
            selected = {
                tag: release.tag_name,
                version: parsedVersion,
            };
        }
    }

    return selected;
}

export async function resolveLatestReleaseForChannel(
    channel: UpdateChannel,
    options: ResolveLatestReleaseOptions = {}
): Promise<ResolvedChannelRelease> {
    const owner = options.owner ?? DEFAULT_OWNER;
    const repo = options.repo ?? DEFAULT_REPO;
    const token = options.token;
    const fetchImpl = options.fetchImpl ?? fetch;

    const requestUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=100`;
    const response = await fetchImpl(requestUrl, {
        method: 'GET',
        headers: toRequestHeaders(token),
    });

    if (!response.ok) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const isRateLimited = response.status === 429 || (response.status === 403 && rateLimitRemaining === '0');

        if (isRateLimited) {
            throw new GitHubReleaseResolverError(
                'rate_limited',
                `GitHub API rate limited while resolving ${channel} channel.`,
                response.status
            );
        }

        throw new GitHubReleaseResolverError(
            'api_error',
            `GitHub API request failed while resolving ${channel} channel.`,
            response.status
        );
    }

    let releases: unknown;

    try {
        releases = await response.json();
    } catch {
        throw new GitHubReleaseResolverError(
            'invalid_response',
            `GitHub API returned invalid JSON while resolving ${channel} channel.`
        );
    }

    if (!Array.isArray(releases)) {
        throw new GitHubReleaseResolverError(
            'invalid_response',
            `GitHub API returned an unexpected release payload while resolving ${channel} channel.`
        );
    }

    const matchingRelease = selectMatchingRelease(releases as GitHubReleaseListItem[], channel);

    if (!matchingRelease) {
        throw new GitHubReleaseResolverError(
            'not_found',
            `No release tag found for ${channel} channel in ${owner}/${repo}.`
        );
    }

    return {
        channel,
        tag: matchingRelease.tag,
        feedBaseUrl: `${GITHUB_WEB_BASE}/${owner}/${repo}/releases/download/${matchingRelease.tag}/`,
    };
}
