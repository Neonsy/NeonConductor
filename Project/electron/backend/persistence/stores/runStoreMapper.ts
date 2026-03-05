import { parseEntityId } from '@/app/backend/persistence/stores/rowParsers';
import type { RunRecord } from '@/app/backend/persistence/types';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import {
    providerAuthMethods,
    runStatuses,
    runtimeCacheStrategies,
    runtimeOpenAITransports,
    runtimeReasoningEfforts,
    runtimeReasoningSummaries,
} from '@/app/backend/runtime/contracts';
import type { ProviderAuthMethod, RunStatus, RuntimeProviderId } from '@/app/backend/runtime/contracts';

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
    return allowed.some((candidate) => candidate === value);
}

function parseRunStatus(value: string): RunStatus {
    if (isOneOf(value, runStatuses)) {
        return value;
    }

    throw new Error(`Invalid run status in persistence row: "${value}".`);
}

function parseAuthMethod(value: string | null): ProviderAuthMethod | 'none' | undefined {
    if (!value) {
        return undefined;
    }

    if (value === 'none') {
        return 'none';
    }

    if (isOneOf(value, providerAuthMethods)) {
        return value;
    }

    throw new Error(`Invalid run auth method in persistence row: "${value}".`);
}

function parseProviderId(value: string | null): RuntimeProviderId | undefined {
    if (!value) {
        return undefined;
    }

    return assertSupportedProviderId(value);
}

function parseReasoningEffort(value: string | null) {
    if (!value) {
        return undefined;
    }

    if (isOneOf(value, runtimeReasoningEfforts)) {
        return value;
    }

    throw new Error(`Invalid run reasoning effort in persistence row: "${value}".`);
}

function parseReasoningSummary(value: string | null) {
    if (!value) {
        return undefined;
    }

    if (isOneOf(value, runtimeReasoningSummaries)) {
        return value;
    }

    throw new Error(`Invalid run reasoning summary in persistence row: "${value}".`);
}

function parseCacheStrategy(value: string | null): 'auto' | 'manual' | undefined {
    if (!value) {
        return undefined;
    }

    if (isOneOf(value, runtimeCacheStrategies)) {
        return value;
    }

    throw new Error(`Invalid run cache strategy in persistence row: "${value}".`);
}

function parseOpenAITransport(value: string | null) {
    if (!value) {
        return undefined;
    }

    if (isOneOf(value, runtimeOpenAITransports)) {
        return value;
    }

    throw new Error(`Invalid run OpenAI transport preference in persistence row: "${value}".`);
}

function parseSelectedTransport(value: string | null): 'responses' | 'chat_completions' | undefined {
    if (!value) {
        return undefined;
    }

    if (value === 'responses' || value === 'chat_completions') {
        return value;
    }

    throw new Error(`Invalid run selected transport in persistence row: "${value}".`);
}

function parseOptionalBoolean(value: number | null): boolean | undefined {
    if (value === null) {
        return undefined;
    }

    if (value === 0) {
        return false;
    }

    if (value === 1) {
        return true;
    }

    throw new Error(`Invalid boolean integer in persistence row: "${String(value)}".`);
}

export interface RunRow {
    id: string;
    session_id: string;
    profile_id: string;
    prompt: string;
    status: string;
    provider_id: string | null;
    model_id: string | null;
    auth_method: string | null;
    reasoning_effort: string | null;
    reasoning_summary: string | null;
    reasoning_include_encrypted: number | null;
    cache_strategy: string | null;
    cache_key: string | null;
    cache_applied: number | null;
    cache_skip_reason: string | null;
    transport_openai_preference: string | null;
    transport_selected: string | null;
    transport_degraded_reason: string | null;
    started_at: string | null;
    completed_at: string | null;
    aborted_at: string | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export function mapRunRecord(row: RunRow): RunRecord {
    const providerId = parseProviderId(row.provider_id);
    const authMethod = parseAuthMethod(row.auth_method);
    const reasoningEffort = parseReasoningEffort(row.reasoning_effort);
    const reasoningSummary = parseReasoningSummary(row.reasoning_summary);
    const reasoningIncludeEncrypted = parseOptionalBoolean(row.reasoning_include_encrypted);
    const cacheStrategy = parseCacheStrategy(row.cache_strategy);
    const cacheApplied = parseOptionalBoolean(row.cache_applied);
    const transportPreference = parseOpenAITransport(row.transport_openai_preference);
    const transportSelected = parseSelectedTransport(row.transport_selected);

    return {
        id: parseEntityId(row.id, 'runs.id', 'run'),
        sessionId: parseEntityId(row.session_id, 'runs.session_id', 'sess'),
        profileId: row.profile_id,
        prompt: row.prompt,
        status: parseRunStatus(row.status),
        ...(providerId ? { providerId } : {}),
        ...(row.model_id ? { modelId: row.model_id } : {}),
        ...(authMethod ? { authMethod } : {}),
        ...(reasoningEffort && reasoningSummary && reasoningIncludeEncrypted !== undefined
            ? {
                  reasoning: {
                      effort: reasoningEffort,
                      summary: reasoningSummary,
                      includeEncrypted: reasoningIncludeEncrypted,
                  },
              }
            : {}),
        ...(cacheStrategy && cacheApplied !== undefined
            ? {
                  cache: {
                      strategy: cacheStrategy,
                      ...(row.cache_key ? { key: row.cache_key } : {}),
                      applied: cacheApplied,
                      ...(row.cache_skip_reason ? { reason: row.cache_skip_reason } : {}),
                  },
              }
            : {}),
        ...(transportPreference
            ? {
                  transport: {
                      openaiPreference: transportPreference,
                      ...(transportSelected ? { selected: transportSelected } : {}),
                      ...(row.transport_degraded_reason ? { degradedReason: row.transport_degraded_reason } : {}),
                  },
              }
            : {}),
        ...(row.started_at ? { startedAt: row.started_at } : {}),
        ...(row.completed_at ? { completedAt: row.completed_at } : {}),
        ...(row.aborted_at ? { abortedAt: row.aborted_at } : {}),
        ...(row.error_code ? { errorCode: row.error_code } : {}),
        ...(row.error_message ? { errorMessage: row.error_message } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
