import { patchProviderCache } from '@/web/components/settings/providerSettings/providerSettingsCache';
import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import {
    patchThreadListRecord,
    replaceThreadTagRelations,
    toThreadListRecord,
    upsertBucketRecord,
    upsertTagRecord,
    upsertThreadListRecord,
} from '@/web/components/conversation/sidebar/sidebarCache';
import { queryClient } from '@/web/lib/providers/trpcCore';

import type { ProviderListItem, ProviderEndpointProfileResult, KiloModelProviderOption } from '@/app/backend/providers/service/types';
import type {
    CheckpointRecord,
    ConversationRecord,
    DiffRecord,
    ProviderAuthStateRecord,
    ProviderModelRecord,
    SessionSummaryRecord,
    TagRecord,
    ThreadRecord,
    ThreadTagRecord,
} from '@/app/backend/persistence/types';
import type {
    KiloModelRoutingPreference,
} from '@/app/backend/runtime/contracts';
import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import type { RuntimeEventContext, TrpcUtils } from '@/web/lib/runtime/invalidation/types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assumeValidated<TValue>(value: unknown): TValue {
    return value as TValue;
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined;
}

function queryKeyContainsSegments(value: unknown, segments: readonly string[]): boolean {
    if (segments.length === 0) {
        return true;
    }

    if (Array.isArray(value)) {
        return segments.every((segment) => value.some((entry) => queryKeyContainsSegments(entry, [segment])));
    }

    if (isRecord(value)) {
        return Object.values(value).some((entry) => queryKeyContainsSegments(entry, segments));
    }

    return typeof value === 'string' && segments.includes(value);
}

function updateMatchingQueryData<TData>(
    pathSegments: readonly string[],
    updater: (current: TData | undefined) => TData | undefined
): void {
    queryClient.setQueriesData(
        {
            predicate: (query) => queryKeyContainsSegments(query.queryKey, pathSegments),
        },
        (current) => updater(current as TData | undefined)
    );
}

function readThreadRecord(value: unknown): ThreadRecord | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['profileId']) || !readString(value['conversationId'])) {
        return undefined;
    }

    return assumeValidated<ThreadRecord>(value);
}

function readConversationRecord(value: unknown): ConversationRecord | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['profileId']) || !readString(value['scope'])) {
        return undefined;
    }

    return assumeValidated<ConversationRecord>(value);
}

function readTagRecord(value: unknown): TagRecord | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['profileId']) || !readString(value['label'])) {
        return undefined;
    }

    return assumeValidated<TagRecord>(value);
}

function readCheckpointRecord(value: unknown): CheckpointRecord | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['sessionId'])) {
        return undefined;
    }

    return assumeValidated<CheckpointRecord>(value);
}

function readDiffRecord(value: unknown): DiffRecord | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['sessionId'])) {
        return undefined;
    }

    return assumeValidated<DiffRecord>(value);
}

function readProviderListItem(value: unknown): ProviderListItem | undefined {
    if (!isRecord(value) || !readString(value['id']) || !readString(value['label'])) {
        return undefined;
    }

    return assumeValidated<ProviderListItem>(value);
}

function readProviderAuthState(value: unknown): ProviderAuthStateRecord | undefined {
    if (!isRecord(value) || !readString(value['profileId']) || !readString(value['providerId']) || !readString(value['authState'])) {
        return undefined;
    }

    return assumeValidated<ProviderAuthStateRecord>(value);
}

function readEndpointProfile(value: unknown): ProviderEndpointProfileResult | undefined {
    return isRecord(value) && readString(value['value'])
        ? assumeValidated<ProviderEndpointProfileResult>(value)
        : undefined;
}

function readProviderDefaults(value: unknown): { providerId: string; modelId: string } | undefined {
    if (!isRecord(value) || !readString(value['providerId']) || !readString(value['modelId'])) {
        return undefined;
    }

    return {
        providerId: readString(value['providerId'])!,
        modelId: readString(value['modelId'])!,
    };
}

function readProviderModels(value: unknown): ProviderModelRecord[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value
        .filter((entry) => isRecord(entry) && readString(entry['id']))
        .map((entry) => assumeValidated<ProviderModelRecord>(entry));
}

function readRoutingPreference(value: unknown): KiloModelRoutingPreference | undefined {
    return isRecord(value) && readString(value['modelId'])
        ? assumeValidated<KiloModelRoutingPreference>(value)
        : undefined;
}

function readModelProviderOptions(value: unknown): KiloModelProviderOption[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value
        .filter((entry) => isRecord(entry) && readString(entry['providerId']))
        .map((entry) => assumeValidated<KiloModelProviderOption>(entry));
}

function replaceProviderModels(currentModels: ProviderModelRecord[], nextModels: ProviderModelRecord[]): ProviderModelRecord[] {
    if (nextModels.length === 0) {
        return currentModels;
    }

    const providerId = nextModels[0]?.providerId;
    return [...currentModels.filter((model) => model.providerId !== providerId), ...nextModels];
}

export async function applyRuntimeEventPatches(
    utils: TrpcUtils,
    event: RuntimeEventRecordV1,
    context: RuntimeEventContext
): Promise<boolean> {
    if (!context.profileId) {
        return false;
    }

    if (event.domain === 'thread') {
        const bucket = readConversationRecord(event.payload['bucket']);
        const thread = readThreadRecord(event.payload['thread']);
        const tagIds = readStringArray(event.payload['tagIds']);
        const deletedThreadIds = readStringArray(event.payload['deletedThreadIds']);
        const deletedTagIds = readStringArray(event.payload['deletedTagIds']);
        const deletedConversationIds = readStringArray(event.payload['deletedConversationIds']);
        const sessionIds = readStringArray(event.payload['sessionIds']);
        const favoriteThreadId = readString(event.payload['threadId']);
        const nextFavorite = typeof event.payload['isFavorite'] === 'boolean' ? event.payload['isFavorite'] : undefined;

        if (bucket && thread) {
            updateMatchingQueryData<{ buckets: ConversationRecord[] }>(['conversation', 'listBuckets'], (current) =>
                current ? { buckets: upsertBucketRecord(current.buckets, bucket) } : current
            );
            updateMatchingQueryData<{
                sort: 'latest' | 'alphabetical';
                showAllModes: boolean;
                groupView: 'workspace' | 'branch';
                threads: ReturnType<typeof toThreadListRecord>[];
            }>(['conversation', 'listThreads'], (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    threads: upsertThreadListRecord(current.threads, toThreadListRecord({ bucket, thread }), current.sort),
                };
            });
            return true;
        }

        if (thread) {
            updateMatchingQueryData<{
                sort: 'latest' | 'alphabetical';
                showAllModes: boolean;
                groupView: 'workspace' | 'branch';
                threads: ReturnType<typeof toThreadListRecord>[];
            }>(['conversation', 'listThreads'], (current) =>
                current
                    ? {
                          ...current,
                          threads: patchThreadListRecord(current.threads, thread),
                      }
                    : current
            );
            return true;
        }

        if (favoriteThreadId && nextFavorite !== undefined) {
            updateMatchingQueryData<{
                sort: 'latest' | 'alphabetical';
                showAllModes: boolean;
                groupView: 'workspace' | 'branch';
                threads: ReturnType<typeof toThreadListRecord>[];
            }>(['conversation', 'listThreads'], (current) =>
                current
                    ? {
                          ...current,
                          threads: current.threads.map((candidate) =>
                              candidate.id === favoriteThreadId ? { ...candidate, isFavorite: nextFavorite } : candidate
                          ),
                      }
                    : current
            );
            return true;
        }

        const profileId = context.profileId;
        const threadId = context.threadId;
        if (profileId && threadId && tagIds) {
            void utils.runtime.getShellBootstrap.setData({ profileId: context.profileId }, (current) => {
                if (!current) {
                    return current;
                }

                const nextThreadTags: ThreadTagRecord[] = tagIds
                    .filter((tagId): tagId is ThreadTagRecord['tagId'] => isEntityId(tagId, 'tag'))
                    .map((tagId) => ({
                        profileId,
                        threadId,
                        tagId,
                        createdAt: event.createdAt,
                    }));

                return {
                    ...current,
                    threadTags: replaceThreadTagRelations(current.threadTags, threadId, nextThreadTags),
                };
            });
            return true;
        }

        if (deletedThreadIds && deletedTagIds && deletedConversationIds) {
            updateMatchingQueryData<{ buckets: ConversationRecord[] }>(['conversation', 'listBuckets'], (current) =>
                current
                    ? {
                          buckets: current.buckets.filter(
                              (bucketRecord) => !new Set(deletedConversationIds).has(bucketRecord.id)
                          ),
                      }
                    : current
            );
            updateMatchingQueryData<{
                sort: 'latest' | 'alphabetical';
                showAllModes: boolean;
                groupView: 'workspace' | 'branch';
                threads: ReturnType<typeof toThreadListRecord>[];
            }>(['conversation', 'listThreads'], (current) =>
                current
                    ? {
                          ...current,
                          threads: current.threads.filter((threadRecord) => !new Set(deletedThreadIds).has(threadRecord.id)),
                      }
                    : current
            );
            updateMatchingQueryData<{ tags: TagRecord[] }>(['conversation', 'listTags'], (current) =>
                current
                    ? {
                          tags: current.tags.filter((tagRecord) => !new Set(deletedTagIds).has(tagRecord.id)),
                      }
                    : current
            );
            void utils.runtime.getShellBootstrap.setData({ profileId: context.profileId }, (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    threadTags: current.threadTags.filter(
                        (threadTag) =>
                            !deletedThreadIds.includes(threadTag.threadId) && !deletedTagIds.includes(threadTag.tagId)
                    ),
                };
            });
            if (sessionIds) {
                updateMatchingQueryData<{ sessions: SessionSummaryRecord[] }>(['session', 'list'], (current) =>
                    current
                        ? {
                              sessions: current.sessions.filter((session) => !new Set(sessionIds).has(session.id)),
                          }
                        : current
                );
            }
            return true;
        }
    }

    if (event.domain === 'tag') {
        const tag = readTagRecord(event.payload['tag']);
        if (!tag) {
            return false;
        }

        updateMatchingQueryData<{ tags: TagRecord[] }>(['conversation', 'listTags'], (current) =>
            current ? { tags: upsertTagRecord(current.tags, tag) } : current
        );
        return true;
    }

    if (event.domain === 'checkpoint') {
        const checkpoint = readCheckpointRecord(event.payload['checkpoint']);
        if (checkpoint) {
            void utils.checkpoint.list.setData(
                {
                    profileId: context.profileId,
                    sessionId: checkpoint.sessionId,
                },
                (current) => ({
                    checkpoints: [checkpoint, ...(current?.checkpoints ?? []).filter((candidate) => candidate.id !== checkpoint.id)],
                })
            );
            const diff = readDiffRecord(event.payload['diff']);
            const runId = diff ? readString(diff.runId) : undefined;
            if (diff && isEntityId(runId, 'run')) {
                void utils.diff.listByRun.setData(
                    {
                        profileId: context.profileId,
                        runId,
                    },
                    (current) => ({
                        diffs: [diff, ...(current?.diffs ?? []).filter((candidate) => candidate.id !== diff.id)],
                    })
                );
            }
            return true;
        }

        return event.eventType === 'checkpoint.rolled_back';
    }

    if (event.domain === 'provider') {
        const providerId = context.providerId;
        if (!providerId) {
            return false;
        }

        const profileId = context.profileId;
        const provider = readProviderListItem(event.payload['provider']);
        const defaults = readProviderDefaults(event.payload['defaults']);
        const models = readProviderModels(event.payload['models']);
        const state = readProviderAuthState(event.payload['state']);
        const endpointProfile = readEndpointProfile(event.payload['endpointProfile']);
        const preference = readRoutingPreference(event.payload['preference']);
        const providers = readModelProviderOptions(event.payload['providers']);
        const modelId = readString(event.payload['modelId']);

        if (!provider && !defaults && !models && !state && !endpointProfile && !preference && !providers) {
            return false;
        }

        patchProviderCache({
            utils,
            profileId,
            providerId,
            ...(provider ? { provider } : {}),
            ...(defaults ? { defaults } : {}),
            ...(models ? { models } : {}),
            ...(state ? { authState: state } : {}),
            ...(endpointProfile ? { endpointProfile } : {}),
            ...(preference ? { routingPreference: preference } : {}),
            ...(providers ? { routingProviders: providers } : {}),
            ...(modelId ? { routingModelId: modelId } : {}),
        });

        void utils.runtime.getShellBootstrap.setData({ profileId }, (current) => {
            if (!current) {
                return current;
            }

            const nextProviders = current.providers.map((candidate) => {
                const providerValue = provider && candidate.id === provider.id ? provider : candidate;
                if (state && providerValue.id === providerId) {
                    return {
                        ...providerValue,
                        authState: state.authState,
                        authMethod: state.authMethod,
                    };
                }

                return providerValue;
            });

            return {
                ...current,
                providers: nextProviders,
                ...(defaults ? { defaults } : {}),
                ...(models ? { providerModels: replaceProviderModels(current.providerModels, models) } : {}),
            };
        });

        return true;
    }

    return false;
}
