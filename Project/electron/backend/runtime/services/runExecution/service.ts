import { messageStore, runStore, runUsageStore, sessionStore } from '@/app/backend/persistence/stores';
import { getProviderAdapter } from '@/app/backend/providers/adapters';
import type { ProviderAuthMethod } from '@/app/backend/runtime/contracts';
import type { EntityId } from '@/app/backend/runtime/contracts';
import { resolveRunAuth } from '@/app/backend/runtime/services/runExecution/resolveRunAuth';
import { resolveRunTarget } from '@/app/backend/runtime/services/runExecution/resolveRunTarget';
import type { StartRunInput, StartRunResult } from '@/app/backend/runtime/services/runExecution/types';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';

interface ActiveRun {
    profileId: string;
    sessionId: string;
    runId: string;
    controller: AbortController;
    completion: Promise<void>;
}

function createSessionKey(profileId: string, sessionId: string): string {
    return `${profileId}:${sessionId}`;
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

interface UsageAccumulator {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
}

interface RunUsageWriteInput {
    runId: string;
    providerId: 'kilo' | 'openai';
    modelId: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
    billedVia: 'kilo_gateway' | 'openai_api' | 'openai_subscription';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mergeUsage(current: UsageAccumulator, next: unknown): UsageAccumulator {
    const merged: UsageAccumulator = {};

    if (current.inputTokens !== undefined) merged.inputTokens = current.inputTokens;
    if (current.outputTokens !== undefined) merged.outputTokens = current.outputTokens;
    if (current.cachedTokens !== undefined) merged.cachedTokens = current.cachedTokens;
    if (current.reasoningTokens !== undefined) merged.reasoningTokens = current.reasoningTokens;
    if (current.totalTokens !== undefined) merged.totalTokens = current.totalTokens;
    if (current.latencyMs !== undefined) merged.latencyMs = current.latencyMs;
    if (current.costMicrounits !== undefined) merged.costMicrounits = current.costMicrounits;

    if (isRecord(next)) {
        const inputTokens = readOptionalFiniteNumber(next['inputTokens']);
        const outputTokens = readOptionalFiniteNumber(next['outputTokens']);
        const cachedTokens = readOptionalFiniteNumber(next['cachedTokens']);
        const reasoningTokens = readOptionalFiniteNumber(next['reasoningTokens']);
        const totalTokens = readOptionalFiniteNumber(next['totalTokens']);
        const latencyMs = readOptionalFiniteNumber(next['latencyMs']);
        const costMicrounits = readOptionalFiniteNumber(next['costMicrounits']);

        if (inputTokens !== undefined) merged.inputTokens = inputTokens;
        if (outputTokens !== undefined) merged.outputTokens = outputTokens;
        if (cachedTokens !== undefined) merged.cachedTokens = cachedTokens;
        if (reasoningTokens !== undefined) merged.reasoningTokens = reasoningTokens;
        if (totalTokens !== undefined) merged.totalTokens = totalTokens;
        if (latencyMs !== undefined) merged.latencyMs = latencyMs;
        if (costMicrounits !== undefined) merged.costMicrounits = costMicrounits;
    }

    return merged;
}

function resolveBilledVia(input: {
    providerId: 'kilo' | 'openai';
    authMethod: string;
}): 'kilo_gateway' | 'openai_api' | 'openai_subscription' {
    if (input.providerId === 'kilo') {
        return 'kilo_gateway';
    }

    if (input.authMethod === 'api_key') {
        return 'openai_api';
    }

    return 'openai_subscription';
}

export class RunExecutionService {
    private readonly activeRuns = new Map<string, ActiveRun>();
    private readonly activeRunsBySession = new Map<string, string>();

    async startRun(input: StartRunInput): Promise<StartRunResult> {
        const runnable = await sessionStore.ensureRunnableSession(input.profileId, input.sessionId);
        if (!runnable.ok) {
            return {
                accepted: false,
                reason: runnable.reason,
            };
        }

        const resolvedTarget = await resolveRunTarget({
            profileId: input.profileId,
            ...(input.providerId ? { providerId: input.providerId } : {}),
            ...(input.modelId ? { modelId: input.modelId } : {}),
        });
        const resolvedAuth = await resolveRunAuth({
            profileId: input.profileId,
            providerId: resolvedTarget.providerId,
        });

        const run = await runStore.create({
            profileId: input.profileId,
            sessionId: input.sessionId,
            prompt: input.prompt,
            providerId: resolvedTarget.providerId,
            modelId: resolvedTarget.modelId,
            authMethod: resolvedAuth.authMethod,
        });

        await sessionStore.markRunPending(input.profileId, input.sessionId, run.id);

        const userMessage = await messageStore.createMessage({
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: run.id,
            role: 'user',
        });
        await messageStore.appendPart({
            messageId: userMessage.id,
            partType: 'text',
            payload: {
                text: input.prompt,
            },
        });

        const assistantMessage = await messageStore.createMessage({
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: run.id,
            role: 'assistant',
        });

        await runtimeEventLogService.append({
            entityType: 'run',
            entityId: run.id,
            eventType: 'run.started',
            payload: {
                run,
                sessionId: input.sessionId,
                profileId: input.profileId,
            },
        });

        const controller = new AbortController();
        const completion = this.executeRun({
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: run.id,
            prompt: input.prompt,
            providerId: resolvedTarget.providerId,
            modelId: resolvedTarget.modelId,
            authMethod: resolvedAuth.authMethod,
            ...(resolvedAuth.apiKey ? { apiKey: resolvedAuth.apiKey } : {}),
            ...(resolvedAuth.accessToken ? { accessToken: resolvedAuth.accessToken } : {}),
            ...(resolvedAuth.organizationId ? { organizationId: resolvedAuth.organizationId } : {}),
            assistantMessageId: assistantMessage.id,
            signal: controller.signal,
        }).finally(() => {
            this.activeRuns.delete(run.id);
            this.activeRunsBySession.delete(createSessionKey(input.profileId, input.sessionId));
        });

        this.activeRuns.set(run.id, {
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: run.id,
            controller,
            completion,
        });
        this.activeRunsBySession.set(createSessionKey(input.profileId, input.sessionId), run.id);

        return {
            accepted: true,
            runId: run.id,
            runStatus: 'running',
        };
    }

    async abortRun(
        profileId: string,
        sessionId: EntityId<'sess'>
    ): Promise<{ aborted: false; reason: 'not_found' | 'not_running' } | { aborted: true; runId: string }> {
        const session = await sessionStore.status(profileId, sessionId);
        if (!session.found) {
            return { aborted: false, reason: 'not_found' };
        }

        if (!session.activeRunId) {
            return { aborted: false, reason: 'not_running' };
        }

        const runId = session.activeRunId;
        const activeRun = this.activeRuns.get(runId);
        if (activeRun) {
            activeRun.controller.abort();
            await activeRun.completion;
            return {
                aborted: true,
                runId,
            };
        }

        await runStore.finalize(runId, {
            status: 'aborted',
        });
        await sessionStore.markRunTerminal(profileId, sessionId, 'aborted');
        await runtimeEventLogService.append({
            entityType: 'run',
            entityId: runId,
            eventType: 'run.aborted',
            payload: {
                runId,
                sessionId,
                profileId,
            },
        });

        return {
            aborted: true,
            runId,
        };
    }

    private async executeRun(input: {
        profileId: string;
        sessionId: string;
        runId: string;
        prompt: string;
        providerId: 'kilo' | 'openai';
        modelId: string;
        authMethod: ProviderAuthMethod | 'none';
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        assistantMessageId: string;
        signal: AbortSignal;
    }): Promise<void> {
        const adapter = getProviderAdapter(input.providerId);
        let usage: UsageAccumulator = {};

        try {
            await adapter.streamCompletion(
                {
                    profileId: input.profileId,
                    modelId: input.modelId,
                    prompt: input.prompt,
                    authMethod: input.authMethod,
                    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
                    ...(input.accessToken ? { accessToken: input.accessToken } : {}),
                    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
                    signal: input.signal,
                },
                {
                    onPart: async (part) => {
                        const appended = await messageStore.appendPart({
                            messageId: input.assistantMessageId,
                            partType: part.partType,
                            payload: part.payload,
                        });
                        await runtimeEventLogService.append({
                            entityType: 'run',
                            entityId: input.runId,
                            eventType: 'run.part.appended',
                            payload: {
                                runId: input.runId,
                                messageId: input.assistantMessageId,
                                part: appended,
                            },
                        });
                    },
                    onUsage: (nextUsage) => {
                        usage = mergeUsage(usage, nextUsage);
                    },
                }
            );

            await runStore.finalize(input.runId, {
                status: 'completed',
            });
            await sessionStore.markRunTerminal(input.profileId, input.sessionId, 'completed');

            await runtimeEventLogService.append({
                entityType: 'run',
                entityId: input.runId,
                eventType: 'run.completed',
                payload: {
                    runId: input.runId,
                    sessionId: input.sessionId,
                    profileId: input.profileId,
                },
            });

            const usageRecordInput: RunUsageWriteInput = {
                runId: input.runId,
                providerId: input.providerId,
                modelId: input.modelId,
                billedVia: resolveBilledVia({ providerId: input.providerId, authMethod: input.authMethod }),
            };

            if (usage.inputTokens !== undefined) usageRecordInput.inputTokens = usage.inputTokens;
            if (usage.outputTokens !== undefined) usageRecordInput.outputTokens = usage.outputTokens;
            if (usage.cachedTokens !== undefined) usageRecordInput.cachedTokens = usage.cachedTokens;
            if (usage.reasoningTokens !== undefined) usageRecordInput.reasoningTokens = usage.reasoningTokens;
            if (usage.totalTokens !== undefined) usageRecordInput.totalTokens = usage.totalTokens;
            if (usage.latencyMs !== undefined) usageRecordInput.latencyMs = usage.latencyMs;
            if (usage.costMicrounits !== undefined) usageRecordInput.costMicrounits = usage.costMicrounits;

            const recordedUsage = await runUsageStore.upsert(usageRecordInput);

            await runtimeEventLogService.append({
                entityType: 'run',
                entityId: input.runId,
                eventType: 'run.usage.recorded',
                payload: {
                    runId: input.runId,
                    usage: recordedUsage,
                },
            });
        } catch (error) {
            if (isAbortError(error) || input.signal.aborted) {
                await runStore.finalize(input.runId, {
                    status: 'aborted',
                });
                await sessionStore.markRunTerminal(input.profileId, input.sessionId, 'aborted');
                await runtimeEventLogService.append({
                    entityType: 'run',
                    entityId: input.runId,
                    eventType: 'run.aborted',
                    payload: {
                        runId: input.runId,
                        sessionId: input.sessionId,
                        profileId: input.profileId,
                    },
                });
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            await runStore.finalize(input.runId, {
                status: 'error',
                errorCode: 'provider_transport_error',
                errorMessage: message,
            });
            await sessionStore.markRunTerminal(input.profileId, input.sessionId, 'error');
            await runtimeEventLogService.append({
                entityType: 'run',
                entityId: input.runId,
                eventType: 'run.failed',
                payload: {
                    runId: input.runId,
                    sessionId: input.sessionId,
                    profileId: input.profileId,
                    errorCode: 'provider_transport_error',
                    errorMessage: message,
                },
            });
        }
    }
}

export const runExecutionService = new RunExecutionService();
