import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { appLog } from '@/app/main/logging';

import type { ResolvedProviderCatalogContext } from '@/app/backend/providers/metadata/catalogContext';
import type { LogContext, ProviderCatalogRefreshReason } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import type { ProviderSyncResult } from '@/app/backend/providers/service/types';

function withLogContext(context?: LogContext): Record<string, string> {
    if (!context) {
        return {};
    }

    return {
        ...(context.requestId ? { requestId: context.requestId } : {}),
        ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    };
}

export function logUnsupportedProviderSyncRejected(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    reason: string;
    error: string;
    context?: LogContext;
}): void {
    appLog.warn({
        tag: 'provider.metadata-orchestrator',
        message: 'Catalog sync rejected for unsupported provider.',
        profileId: input.profileId,
        providerId: input.providerId,
        reason: input.reason,
        error: input.error,
        ...withLogContext(input.context),
    });
}

export function logBackgroundRefreshFailure(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    error: string;
    context?: LogContext;
}): void {
    appLog.warn({
        tag: 'provider.metadata-orchestrator',
        message: 'Background provider metadata refresh failed.',
        profileId: input.profileId,
        providerId: input.providerId,
        error: input.error,
        ...withLogContext(input.context),
    });
}

export function logSyncStart(input: {
    context: ResolvedProviderCatalogContext;
    force: boolean;
    reason: ProviderCatalogRefreshReason;
    logContext?: LogContext;
}): void {
    appLog.info({
        tag: 'provider.metadata-orchestrator',
        message: 'Starting provider metadata sync.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        force: input.force,
        reason: input.reason,
        authMethod: input.context.authMethod,
        optionProfileId: input.context.optionProfileId,
        resolvedBaseUrl: input.context.resolvedBaseUrl ?? null,
        organizationId: input.context.organizationId ?? null,
        ...withLogContext(input.logContext),
    });
}

export function logSyncFailure(input: {
    context: ResolvedProviderCatalogContext;
    reason: string;
    detail?: string;
    logContext?: LogContext;
}): void {
    appLog.warn({
        tag: 'provider.metadata-orchestrator',
        message: 'Provider metadata sync failed.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        reason: input.reason,
        detail: input.detail ?? null,
        ...withLogContext(input.logContext),
    });
}

export function logDroppedInvalidRows(input: {
    context: ResolvedProviderCatalogContext;
    droppedCount: number;
    logContext?: LogContext;
}): void {
    appLog.warn({
        tag: 'provider.metadata-orchestrator',
        message: 'Dropped invalid provider metadata rows during normalization.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        droppedCount: input.droppedCount,
        ...withLogContext(input.logContext),
    });
}

export function logStaleFetchDiscarded(input: {
    context: ResolvedProviderCatalogContext;
    reason: ProviderCatalogRefreshReason;
    logContext?: LogContext;
}): void {
    appLog.info({
        tag: 'provider.metadata-orchestrator',
        message: 'Skipped stale provider metadata sync because catalog scope changed during fetch.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        reason: input.reason,
        optionProfileId: input.context.optionProfileId,
        organizationId: input.context.organizationId ?? null,
        ...withLogContext(input.logContext),
    });
}

export function logStalePersistenceDiscarded(input: {
    context: ResolvedProviderCatalogContext;
    reason: ProviderCatalogRefreshReason;
    logContext?: LogContext;
}): void {
    appLog.info({
        tag: 'provider.metadata-orchestrator',
        message: 'Discarded provider metadata sync results because catalog scope changed during persistence.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        reason: input.reason,
        ...withLogContext(input.logContext),
    });
}

export function logStaleResyncFailure(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    error: string;
    logContext?: LogContext;
}): void {
    appLog.warn({
        tag: 'provider.metadata-orchestrator',
        message: 'Failed to resync provider metadata after discarding stale persisted results.',
        profileId: input.profileId,
        providerId: input.providerId,
        error: input.error,
        ...withLogContext(input.logContext),
    });
}

export function logSyncCompleted(input: {
    context: ResolvedProviderCatalogContext;
    result: ProviderSyncResult;
    overrideCount: number;
    derivedCount: number;
    droppedCount: number;
    logContext?: LogContext;
}): void {
    appLog.info({
        tag: 'provider.metadata-orchestrator',
        message: 'Provider metadata sync completed.',
        profileId: input.context.profileId,
        providerId: input.context.providerId,
        status: input.result.status,
        modelCount: input.result.modelCount,
        overrideCount: input.overrideCount,
        derivedCount: input.derivedCount,
        droppedCount: input.droppedCount,
        optionProfileId: input.context.optionProfileId,
        resolvedBaseUrl: input.context.resolvedBaseUrl ?? null,
        organizationId: input.context.organizationId ?? null,
        ...withLogContext(input.logContext),
    });
}
