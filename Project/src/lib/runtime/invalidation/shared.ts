import { isEntityId, isProviderId } from '@/web/components/conversation/shellHelpers';
import { trpc } from '@/web/trpc/client';

import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import type { EntityId, RuntimeProviderId, TopLevelTab } from '@/app/backend/runtime/contracts';

export type TrpcUtils = ReturnType<typeof trpc.useUtils>;

export interface ConversationSelectionState {
    selectedSessionId: EntityId<'sess'> | undefined;
    selectedRunId: EntityId<'run'> | undefined;
}

export interface RuntimeEventContext {
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

export function hasPayloadKey(event: RuntimeEventRecordV1, key: string): boolean {
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

export function getRuntimeEventContext(event: RuntimeEventRecordV1): RuntimeEventContext {
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

export function isSelectedSessionAffected(context: RuntimeEventContext): boolean {
    return Boolean(context.sessionId && context.selection.selectedSessionId === context.sessionId);
}

export function isSelectedRunAffected(context: RuntimeEventContext): boolean {
    return Boolean(context.runId && context.selection.selectedRunId === context.runId);
}

export function hasSelectedWorkspaceImpact(context: RuntimeEventContext): boolean {
    if (isSelectedSessionAffected(context) || isSelectedRunAffected(context)) {
        return true;
    }

    return Boolean(!context.runId && context.sessionId && context.selection.selectedSessionId === context.sessionId);
}

export function addInvalidation(
    invalidations: Array<Promise<unknown>>,
    task: Promise<unknown> | undefined
): void {
    if (task) {
        invalidations.push(task);
    }
}

export function invalidateThreadList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId
        ? utils.conversation.listThreads.invalidate({ profileId })
        : utils.conversation.listThreads.invalidate();
}

export function invalidateBucketList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId
        ? utils.conversation.listBuckets.invalidate({ profileId })
        : utils.conversation.listBuckets.invalidate();
}

export function invalidateTagList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId ? utils.conversation.listTags.invalidate({ profileId }) : utils.conversation.listTags.invalidate();
}

export function invalidateShellBootstrap(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId
        ? utils.runtime.getShellBootstrap.invalidate({ profileId })
        : utils.runtime.getShellBootstrap.invalidate();
}

export function invalidateSessionList(utils: TrpcUtils, profileId: string | undefined): Promise<unknown> {
    return profileId ? utils.session.list.invalidate({ profileId }) : utils.session.list.invalidate();
}

export function invalidateSessionStatus(
    utils: TrpcUtils,
    profileId: string | undefined,
    sessionId: EntityId<'sess'> | undefined
): Promise<unknown> {
    if (profileId && sessionId) {
        return utils.session.status.invalidate({ profileId, sessionId });
    }

    return utils.session.status.invalidate();
}

export function invalidateSessionRuns(
    utils: TrpcUtils,
    profileId: string | undefined,
    sessionId: EntityId<'sess'> | undefined
): Promise<unknown> {
    if (profileId && sessionId) {
        return utils.session.listRuns.invalidate({ profileId, sessionId });
    }

    return utils.session.listRuns.invalidate();
}

export function invalidateSessionMessages(
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

export function invalidateSelectedMessages(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    return invalidateSessionMessages(
        utils,
        context.profileId,
        context.selection.selectedSessionId,
        context.selection.selectedRunId
    );
}

export function invalidatePlanActive(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    if (context.profileId && context.sessionId && context.topLevelTab) {
        return utils.plan.getActive.invalidate({
            profileId: context.profileId,
            sessionId: context.sessionId,
            topLevelTab: context.topLevelTab,
        });
    }

    return utils.plan.getActive.invalidate();
}

export function invalidateOrchestratorLatest(utils: TrpcUtils, context: RuntimeEventContext): Promise<unknown> {
    if (context.profileId && context.sessionId) {
        return utils.orchestrator.latestBySession.invalidate({
            profileId: context.profileId,
            sessionId: context.sessionId,
        });
    }

    return utils.orchestrator.latestBySession.invalidate();
}

export function invalidateProfileQueries(utils: TrpcUtils, profileId: string | undefined): Promise<void> {
    return Promise.all([
        utils.profile.list.invalidate(),
        utils.profile.getActive.invalidate(),
        invalidateShellBootstrap(utils, profileId),
    ]).then(() => undefined);
}

export async function invalidateRuntimeResetQueries(utils: TrpcUtils): Promise<void> {
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
}
