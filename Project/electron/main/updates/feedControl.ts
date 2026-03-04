import { err, ok, type Result } from 'neverthrow';

import { GitHubReleaseResolverError, resolveLatestReleaseForChannel } from '@/app/main/updates/githubReleaseResolver';
import type { UpdateChannel } from '@/app/main/updates/updater';

export type UpdaterOperationErrorCode = 'resolver_failed' | 'check_failed';

export interface UpdaterOperationError {
    code: UpdaterOperationErrorCode;
    message: string;
}

export interface ConfigureFeedOptions {
    forceRefresh?: boolean;
    applyResolvedChannel?: boolean;
}

export interface CachedFeedConfig {
    tag: string;
    feedBaseUrl: string;
}

interface UpdaterLogger {
    info: (event: Record<string, unknown>) => void;
    error: (event: Record<string, unknown>) => void;
}

interface UpdaterFeedClient {
    setFeedURL: (options: { provider: 'generic'; url: string; channel: string }) => void;
    checkForUpdates: () => Promise<unknown>;
}

interface ConfigureFeedForChannelInput {
    channel: UpdateChannel;
    options?: ConfigureFeedOptions;
    resolvedFeedCache: Map<UpdateChannel, CachedFeedConfig>;
    applyChannel: (channel: UpdateChannel) => void;
    toUpdaterChannel: (channel: UpdateChannel) => 'latest' | 'beta' | 'alpha';
    updaterClient: UpdaterFeedClient;
    logger: UpdaterLogger;
}

type CheckForUpdatesForSelectedChannelInput = ConfigureFeedForChannelInput;

export async function configureFeedForChannel(
    input: ConfigureFeedForChannelInput
): Promise<Result<void, UpdaterOperationError>> {
    const forceRefresh = input.options?.forceRefresh ?? false;
    const applyResolvedChannel = input.options?.applyResolvedChannel ?? true;

    let feedConfig = !forceRefresh ? input.resolvedFeedCache.get(input.channel) : undefined;

    try {
        if (!feedConfig) {
            const release = await resolveLatestReleaseForChannel(input.channel);
            feedConfig = {
                tag: release.tag,
                feedBaseUrl: release.feedBaseUrl,
            };
            input.resolvedFeedCache.set(input.channel, feedConfig);
        }

        const resolvedFeed = feedConfig;

        input.logger.info({
            tag: 'updater.resolver',
            message: 'Resolved feed configuration.',
            channel: input.channel,
            releaseTag: resolvedFeed.tag,
            feedBaseUrl: resolvedFeed.feedBaseUrl,
        });

        input.updaterClient.setFeedURL({
            provider: 'generic',
            url: resolvedFeed.feedBaseUrl,
            channel: input.toUpdaterChannel(input.channel),
        });

        if (applyResolvedChannel) {
            input.applyChannel(input.channel);
        }
        return ok(undefined);
    } catch (error) {
        if (error instanceof GitHubReleaseResolverError) {
            input.logger.error({
                tag: 'updater.resolver',
                message: 'Failed to resolve feed channel.',
                channel: input.channel,
                code: error.code,
                statusCode: error.statusCode,
                error: error.message,
            });
        } else {
            input.logger.error({
                tag: 'updater.resolver',
                message: 'Failed to resolve feed.',
                channel: input.channel,
                ...(error instanceof Error ? { error: error.message } : { error: String(error) }),
            });
        }

        return err({
            code: 'resolver_failed',
            message: 'Failed to resolve feed for selected channel.',
        });
    }
}

export async function checkForUpdatesForSelectedChannel(
    input: CheckForUpdatesForSelectedChannelInput
): Promise<Result<void, UpdaterOperationError>> {
    const configureResult = await configureFeedForChannel({
        ...input,
        options: {
            forceRefresh: input.options?.forceRefresh ?? true,
            applyResolvedChannel: input.options?.applyResolvedChannel ?? true,
        },
    });

    if (configureResult.isErr()) {
        return configureResult;
    }

    try {
        await input.updaterClient.checkForUpdates();
        return ok(undefined);
    } catch {
        return err({
            code: 'check_failed',
            message: 'Failed to check for updates for selected channel.',
        });
    }
}
