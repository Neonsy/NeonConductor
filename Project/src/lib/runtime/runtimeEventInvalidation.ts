import { isEntityId, isProviderId } from '@/web/components/conversation/shellHelpers';
import { trpc } from '@/web/trpc/client';

import type { RuntimeEventDomain, RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import type { EntityId, RuntimeProviderId, TopLevelTab } from '@/app/backend/runtime/contracts';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

interface ConversationSelectionState {
    selectedSessionId: EntityId<'sess'> | undefined;
    selectedRunId: EntityId<'run'> | undefined;
}

interface RuntimeEventContext {
    profileId: string | undefined;
    sessionId: EntityId<'sess'> | undefined;
    runId: EntityId<'run'> | undefined;
    threadId: EntityId<'thr'> | undefined;
    tagId: EntityId<'tag'> | undefined;
    providerId: RuntimeProviderId | undefined;
    modelId: string | undefined;
    topLevelTab: TopLevelTab | undefined;
    selection: ConversationSelectionState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function hasPayloadKey(event: RuntimeEventRecordV1, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(event.payload, key);
}

function readPayloadString(event: RuntimeEventRecordV1, key: string): string | undefined {
    return readString(event.payload[key]);
}

function readPayloadEntityId<P extends 'sess' | 'run' | 'thr' | 'tag'>(
    event: RuntimeEventRecordV1,
    key: string,
    prefix: P
): EntityId<P> | undefined {
    const value = readPayloadString(event, key);
    return isEntityId(value, prefix) ? value : undefined;
}

function readPayloadTopLevelTab(event: RuntimeEventRecordV1): TopLevelTab | undefined {
    const value = readPayloadString(event, 'topLevelTab');
    return value === 'chat' || value === 'agent' || value === 'orchestrator' ? value : undefined;
}

function readSelectionState(profileId: string | undefined): ConversationSelectionState {
    if (!profileId || typeof window === 'undefined') {
        return {
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }

    const raw = window.localStorage.getItem(`neonconductor.conversation.ui.${profileId}`);
    if (!raw) {
        return {
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return {
                selectedSessionId: undefined,
                selectedRunId: undefined,
            };
        }

        const selectedSessionId = readString(parsed['selectedSessionId']);
        const selectedRunId = readString(parsed['selectedRunId']);
        return {
            selectedSessionId: isEntityId(selectedSessionId, 'sess') ? selectedSessionId : undefined,
            selectedRunId: isEntityId(selectedRunId, 'run') ? selectedRunId : undefined,
        };
    } catch {
        return {
            selectedSessionId: undefined,
            selectedRunId: undefined,
        };
    }
}

function getRuntimeEventContext(event: RuntimeEventRecordV1): RuntimeEventContext {
    const profileId = readPayloadString(event, 'profileId');
    const sessionId =
        readPayloadEntityId(event, 'sessionId', 'sess') ||
        (event.domain === 'session' && isEntityId(event.entityId, 'sess') ? event.entityId : undefined);
    const runId =
        readPayloadEntityId(event, 'runId', 'run') ||
        (event.domain === 'run' && isEntityId(event.entityId, 'run') ? event.entityId : undefined);
    const threadId =
        readPayloadEntityId(event, 'threadId', 'thr') ||
        (event.domain === 'thread' && isEntityId(event.entityId, 'thr') ? event.entityId : undefined);
    const tagId =
        readPayloadEntityId(event, 'tagId', 'tag') ||
        (event.domain === 'tag' && isEntityId(event.entityId, 'tag') ? event.entityId : undefined);
    const providerValue =
        readPayloadString(event, 'providerId') || (event.domain === 'provider' ? event.entityId : undefined);

    return {
        profileId,
        sessionId,
        runId,
        threadId,
        tagId,
        providerId: isProviderId(providerValue) ? providerValue : undefined,
        modelId: readPayloadString(event, 'modelId'),
        topLevelTab: readPayloadTopLevelTab(event),
        selection: readSelectionState(profileId),
    };
}

function isSelectedSessionAffected(context: RuntimeEventContext): boolean {
    return Boolean(context.sessionId && context.selection.selectedSessionId === context.sessionId);
}

function isSelectedRunAffected(context: RuntimeEventContext): boolean {
    return Boolean(context.runId && context.selection.selectedRunId === context.runId);
}

function hasSelectedWorkspaceImpact(context: RuntimeEventContext): boolean {
    if (isSelectedSessionAffected(context) || isSelectedRunAffected(context)) {
        return true;
    }

    return Boolean(!context.runId && context.sessionId && context.selection.selectedSessionId === context.sessionId);
}

function addInvalidation(
    invalidations: Array<Promise<unknown>>,
    task: Promise<unknown> | undefined
): void {
    if (task) {
        invalidations.push(task);
    }
}

function invalidateThreadList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId
        ? utils.conversation.listThreads.invalidate({ profileId })
        : utils.conversation.listThreads.invalidate();
}

function invalidateBucketList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId
        ? utils.conversation.listBuckets.invalidate({ profileId })
        : utils.conversation.listBuckets.invalidate();
}

function invalidateTagList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId ? utils.conversation.listTags.invalidate({ profileId }) : utils.conversation.listTags.invalidate();
}

function invalidateShellBootstrap(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId ? utils.runtime.getShellBootstrap.invalidate({ profileId }) : utils.runtime.getShellBootstrap.invalidate();
}

function invalidateSessionList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId ? utils.session.list.invalidate({ profileId }) : utils.session.list.invalidate();
}

function invalidateSessionStatus(
    utils: TrpcUtils,
    profileId: string | undefined,
    sessionId: EntityId<'sess'> | undefined
): Promise<unknown> {
    if (profileId && sessionId) {
        return utils.session.status.invalidate({ profileId, sessionId });
    }

    return utils.session.status.invalidate();
}

function invalidateSessionRuns(
    utils: TrpcUtils,
    profileId: string | undefined,
    sessionId: EntityId<'sess'> | undefined
): Promise<unknown> {
    if (profileId && sessionId) {
        return utils.session.listRuns.invalidate({ profileId, sessionId });
    }

    return utils.session.listRuns.invalidate();
}

function invalidateSessionMessages(
    utils: TrpcUtils,
    profileId: string | undefined,
    sessionId: EntityId<'sess'> | undefined,
    runId?: EntityId<'run'>
): Promise<unknown> {
    if (profileId && sessionId) {
        return utils.session.listMessages.invalidate({
            profileId,
            sessionId,
            ...(runId ? { runId } : {}),
        });
    }

    return utils.session.listMessages.invalidate();
}

function invalidateSelectedMessages(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    return invalidateSessionMessages(
        utils,
        context.profileId,
        context.selection.selectedSessionId,
        context.selection.selectedRunId
    );
}

function invalidatePlanActive(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    if (context.profileId && context.sessionId && context.topLevelTab) {
        return utils.plan.getActive.invalidate({
            profileId: context.profileId,
            sessionId: context.sessionId,
            topLevelTab: context.topLevelTab,
        });
    }

    return utils.plan.getActive.invalidate();
}

function invalidateOrchestratorLatest(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    if (context.profileId && context.sessionId) {
        return utils.orchestrator.latestBySession.invalidate({
            profileId: context.profileId,
            sessionId: context.sessionId,
        });
    }

    return utils.orchestrator.latestBySession.invalidate();
}

function invalidateProfileQueries(utils: TrpcUtils, profileId: string | undefined): Promise<void> {
    return Promise.all([
        utils.profile.list.invalidate(),
        utils.profile.getActive.invalidate(),
        invalidateShellBootstrap(utils, profileId),
    ]).then(() => undefined);
}

function isThreadRelationEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return Boolean(context.tagId || hasPayloadKey(event, 'tagIds'));
}

function isBucketAffectingThreadEvent(event: RuntimeEventRecordV1): boolean {
    return event.operation === 'remove' || hasPayloadKey(event, 'bucket');
}

function isTagRelationEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return Boolean(context.threadId || context.tagId || hasPayloadKey(event, 'tagIds'));
}

function isProviderCatalogEvent(event: RuntimeEventRecordV1): boolean {
    return event.operation === 'sync' || hasPayloadKey(event, 'modelCount');
}

function isProviderRoutingEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return context.providerId === 'kilo' && Boolean(context.modelId) && hasPayloadKey(event, 'routingMode');
}

function isProviderDefaultEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return Boolean(
        context.providerId &&
            context.modelId &&
            event.operation === 'upsert' &&
            !hasPayloadKey(event, 'routingMode') &&
            !hasPayloadKey(event, 'flowId')
    );
}

function isProviderEndpointProfileEvent(event: RuntimeEventRecordV1): boolean {
    return hasPayloadKey(event, 'value');
}

function isProviderAccountContextEvent(event: RuntimeEventRecordV1): boolean {
    return hasPayloadKey(event, 'organizationId') || hasPayloadKey(event, 'accountId');
}

function isProviderAuthEvent(event: RuntimeEventRecordV1): boolean {
    return hasPayloadKey(event, 'authState') || hasPayloadKey(event, 'flowId') || event.operation === 'status';
}

function invalidationTable(): Record<
    RuntimeEventDomain,
    (utils: TrpcUtils, event: RuntimeEventRecordV1, context: RuntimeEventContext) => Promise<void>
> {
    return {
        conversation: async (utils, _event, context) => {
            await Promise.all([invalidateThreadList(utils, context.profileId), invalidateBucketList(utils, context.profileId)]);
        },
        thread: async (utils, event, context) => {
            const invalidations: Array<Promise<unknown>> = [invalidateThreadList(utils, context.profileId)];
            if (isBucketAffectingThreadEvent(event)) {
                addInvalidation(invalidations, invalidateBucketList(utils, context.profileId));
            }
            if (isThreadRelationEvent(event, context)) {
                addInvalidation(invalidations, invalidateTagList(utils, context.profileId));
                addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
            }

            await Promise.all(invalidations);
        },
        tag: async (utils, event, context) => {
            const invalidations: Array<Promise<unknown>> = [invalidateTagList(utils, context.profileId)];
            if (isTagRelationEvent(event, context)) {
                addInvalidation(invalidations, invalidateThreadList(utils, context.profileId));
                addInvalidation(invalidations, invalidateBucketList(utils, context.profileId));
                addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
            }

            await Promise.all(invalidations);
        },
        session: async (utils, _event, context) => {
            const invalidations: Array<Promise<unknown>> = [
                invalidateSessionList(utils, context.profileId),
                invalidateSessionStatus(utils, context.profileId, context.sessionId),
                invalidateThreadList(utils, context.profileId),
            ];

            if (hasSelectedWorkspaceImpact(context)) {
                addInvalidation(invalidations, invalidateSessionRuns(utils, context.profileId, context.selection.selectedSessionId));
                addInvalidation(invalidations, invalidateSelectedMessages(utils, context));
            }

            await Promise.all(invalidations);
        },
        run: async (utils, _event, context) => {
            const invalidations: Array<Promise<unknown>> = [
                invalidateSessionList(utils, context.profileId),
                invalidateSessionStatus(utils, context.profileId, context.sessionId),
                invalidateThreadList(utils, context.profileId),
                invalidateSessionRuns(utils, context.profileId, context.sessionId),
            ];

            if (hasSelectedWorkspaceImpact(context)) {
                addInvalidation(invalidations, invalidateSelectedMessages(utils, context));
            }

            await Promise.all(invalidations);
        },
        message: async (utils, _event, context) => {
            if (!hasSelectedWorkspaceImpact(context)) {
                return;
            }

            await invalidateSelectedMessages(utils, context);
        },
        messagePart: async (utils, _event, context) => {
            if (!hasSelectedWorkspaceImpact(context)) {
                return;
            }

            await invalidateSelectedMessages(utils, context);
        },
        provider: async (utils, event, context) => {
            const invalidations: Array<Promise<unknown>> = [];

            if (context.profileId && context.providerId && isProviderAuthEvent(event)) {
                addInvalidation(
                    invalidations,
                    utils.provider.getAuthState.invalidate({
                        profileId: context.profileId,
                        providerId: context.providerId,
                    })
                );
            } else if (isProviderAuthEvent(event)) {
                addInvalidation(invalidations, utils.provider.getAuthState.invalidate());
            }

            if (isProviderAccountContextEvent(event)) {
                addInvalidation(
                    invalidations,
                    context.profileId && context.providerId
                        ? utils.provider.getAccountContext.invalidate({
                              profileId: context.profileId,
                              providerId: context.providerId,
                          })
                        : utils.provider.getAccountContext.invalidate()
                );
            }

            if (isProviderEndpointProfileEvent(event)) {
                addInvalidation(
                    invalidations,
                    context.profileId && context.providerId
                        ? utils.provider.getEndpointProfile.invalidate({
                              profileId: context.profileId,
                              providerId: context.providerId,
                          })
                        : utils.provider.getEndpointProfile.invalidate()
                );
            }

            if (isProviderCatalogEvent(event)) {
                addInvalidation(
                    invalidations,
                    context.profileId && context.providerId
                        ? utils.provider.listModels.invalidate({
                              profileId: context.profileId,
                              providerId: context.providerId,
                          })
                        : utils.provider.listModels.invalidate()
                );
                addInvalidation(
                    invalidations,
                    context.profileId
                        ? utils.provider.listModelProviders.invalidate({ profileId: context.profileId })
                        : utils.provider.listModelProviders.invalidate()
                );
                addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
            }

            if (isProviderDefaultEvent(event, context)) {
                addInvalidation(
                    invalidations,
                    context.profileId
                        ? utils.provider.getDefaults.invalidate({ profileId: context.profileId })
                        : utils.provider.getDefaults.invalidate()
                );
                addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
            }

            if (isProviderRoutingEvent(event, context)) {
                addInvalidation(
                    invalidations,
                    context.profileId && context.modelId
                        ? utils.provider.getModelRoutingPreference.invalidate({
                              profileId: context.profileId,
                              providerId: 'kilo',
                              modelId: context.modelId,
                          })
                        : utils.provider.getModelRoutingPreference.invalidate()
                );
            }

            await Promise.all(invalidations);
        },
        plan: async (utils, event, context) => {
            const invalidations: Array<Promise<unknown>> = [invalidatePlanActive(utils, context)];
            if (hasPayloadKey(event, 'runId') || hasPayloadKey(event, 'orchestratorRunId')) {
                addInvalidation(invalidations, invalidateSessionRuns(utils, context.profileId, context.sessionId));
            }

            await Promise.all(invalidations);
        },
        orchestrator: async (utils, _event, context) => {
            await invalidateOrchestratorLatest(utils, context);
        },
        profile: async (utils, _event, context) => {
            await invalidateProfileQueries(utils, context.profileId);
        },
        permission: async () => {},
        tool: async () => {},
        mcp: async () => {},
        runtime: async (utils, event) => {
            if (event.operation !== 'reset') {
                return;
            }

            await Promise.all([
                utils.runtime.getShellBootstrap.invalidate(),
                utils.runtime.getDiagnosticSnapshot.invalidate(),
                utils.conversation.listBuckets.invalidate(),
                utils.conversation.listTags.invalidate(),
                utils.conversation.listThreads.invalidate(),
                utils.session.list.invalidate(),
                utils.session.status.invalidate(),
                utils.session.listRuns.invalidate(),
                utils.session.listMessages.invalidate(),
                utils.provider.listProviders.invalidate(),
                utils.provider.getDefaults.invalidate(),
                utils.provider.listModels.invalidate(),
                utils.provider.getAuthState.invalidate(),
                utils.provider.getAccountContext.invalidate(),
                utils.provider.getEndpointProfile.invalidate(),
                utils.provider.getModelRoutingPreference.invalidate(),
                utils.provider.listModelProviders.invalidate(),
                utils.provider.getUsageSummary.invalidate(),
                utils.provider.getOpenAISubscriptionUsage.invalidate(),
                utils.provider.getOpenAISubscriptionRateLimits.invalidate(),
                utils.plan.getActive.invalidate(),
                utils.orchestrator.latestBySession.invalidate(),
                utils.profile.list.invalidate(),
                utils.profile.getActive.invalidate(),
                utils.mode.list.invalidate(),
                utils.mode.getActive.invalidate(),
                utils.permission.listPending.invalidate(),
                utils.tool.list.invalidate(),
                utils.mcp.listServers.invalidate(),
            ]);
        },
    };
}

const runtimeEventInvalidators = invalidationTable();

export async function invalidateQueriesForRuntimeEvent(
    utils: TrpcUtils,
    event: RuntimeEventRecordV1
): Promise<void> {
    const context = getRuntimeEventContext(event);
    await runtimeEventInvalidators[event.domain](utils, event, context);
}
