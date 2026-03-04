import { messageStore, providerStore, runStore, sessionStore } from '@/app/backend/persistence/stores';
import type { ProviderRuntimeTransportSelection } from '@/app/backend/providers/types';
import type { EntityId, ProviderAuthMethod, RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { resolveRunCache } from '@/app/backend/runtime/services/runExecution/cacheKey';
import { validateRunCapabilities } from '@/app/backend/runtime/services/runExecution/capabilities';
import {
    emitCacheResolutionEvent,
    emitTransportSelectionEvent,
} from '@/app/backend/runtime/services/runExecution/eventing';
import { executeRun, isAbortError } from '@/app/backend/runtime/services/runExecution/executeRun';
import { resolveModeExecution } from '@/app/backend/runtime/services/runExecution/mode';
import { resolveRunAuth } from '@/app/backend/runtime/services/runExecution/resolveRunAuth';
import { resolveFirstRunnableRunTarget } from '@/app/backend/runtime/services/runExecution/resolveRunnableTarget';
import { resolveRunTarget } from '@/app/backend/runtime/services/runExecution/resolveRunTarget';
import { resolveInitialRunTransport } from '@/app/backend/runtime/services/runExecution/transport';
import type {
    ResolvedRunAuth,
    RunCacheResolution,
    StartRunInput,
    StartRunResult,
} from '@/app/backend/runtime/services/runExecution/types';
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

        const resolvedMode = await resolveModeExecution({
            profileId: input.profileId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
        });

        const resolvedTarget = await resolveRunTarget({
            profileId: input.profileId,
            ...(input.providerId ? { providerId: input.providerId } : {}),
            ...(input.modelId ? { modelId: input.modelId } : {}),
        });
        const explicitTargetRequested = input.providerId !== undefined || input.modelId !== undefined;
        let activeTarget = resolvedTarget;
        let resolvedAuth: ResolvedRunAuth;
        try {
            resolvedAuth = await resolveRunAuth({
                profileId: input.profileId,
                providerId: activeTarget.providerId,
            });
        } catch (error) {
            if (explicitTargetRequested) {
                throw error;
            }

            const fallback = await resolveFirstRunnableRunTarget(input.profileId, {
                providerId: activeTarget.providerId,
                modelId: activeTarget.modelId,
            });
            if (!fallback) {
                throw error;
            }

            activeTarget = fallback.target;
            resolvedAuth = fallback.auth;
        }
        const modelCapabilities = await providerStore.getModelCapabilities(
            input.profileId,
            activeTarget.providerId,
            activeTarget.modelId
        );
        if (!modelCapabilities) {
            throw new Error(`Model "${activeTarget.modelId}" is missing runtime capabilities.`);
        }

        validateRunCapabilities({
            providerId: activeTarget.providerId,
            modelId: activeTarget.modelId,
            modelCapabilities,
            runtimeOptions: input.runtimeOptions,
        });

        const initialTransport = resolveInitialRunTransport({
            providerId: activeTarget.providerId,
            runtimeOptions: input.runtimeOptions,
        });
        const resolvedCache = resolveRunCache({
            profileId: input.profileId,
            sessionId: input.sessionId,
            providerId: activeTarget.providerId,
            modelId: activeTarget.modelId,
            runtimeOptions: input.runtimeOptions,
        });

        const run = await runStore.create({
            profileId: input.profileId,
            sessionId: input.sessionId,
            prompt: input.prompt,
            providerId: activeTarget.providerId,
            modelId: activeTarget.modelId,
            authMethod: resolvedAuth.authMethod,
            runtimeOptions: input.runtimeOptions,
            cache: resolvedCache,
            transport: {
                selected: initialTransport.selected,
                ...(initialTransport.degraded
                    ? {
                          degradedReason: initialTransport.degradedReason,
                      }
                    : {}),
            },
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
            eventType: 'run.mode.context',
            payload: {
                runId: run.id,
                sessionId: input.sessionId,
                profileId: input.profileId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                workspaceFingerprint: input.workspaceFingerprint ?? null,
                mode: {
                    id: resolvedMode.mode.id,
                    label: resolvedMode.mode.label,
                    executionPolicy: resolvedMode.mode.executionPolicy,
                },
            },
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

        await emitCacheResolutionEvent({
            runId: run.id,
            profileId: input.profileId,
            sessionId: input.sessionId,
            cache: resolvedCache,
        });
        await emitTransportSelectionEvent({
            runId: run.id,
            profileId: input.profileId,
            sessionId: input.sessionId,
            selection: {
                selected: initialTransport.selected,
                requested: initialTransport.requested,
                degraded: initialTransport.degraded,
                ...(initialTransport.degradedReason ? { degradedReason: initialTransport.degradedReason } : {}),
            },
        });

        const controller = new AbortController();
        const completion = this.runToTerminalState({
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: run.id,
            prompt: input.prompt,
            providerId: activeTarget.providerId,
            modelId: activeTarget.modelId,
            authMethod: resolvedAuth.authMethod,
            runtimeOptions: input.runtimeOptions,
            cache: resolvedCache,
            transportSelection: {
                selected: initialTransport.selected,
                requested: initialTransport.requested,
                degraded: initialTransport.degraded,
                ...(initialTransport.degradedReason ? { degradedReason: initialTransport.degradedReason } : {}),
            },
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

    private async runToTerminalState(input: {
        profileId: string;
        sessionId: string;
        runId: string;
        prompt: string;
        providerId: RuntimeProviderId;
        modelId: string;
        authMethod: ProviderAuthMethod | 'none';
        runtimeOptions: StartRunInput['runtimeOptions'];
        cache: RunCacheResolution;
        transportSelection: ProviderRuntimeTransportSelection;
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        assistantMessageId: string;
        signal: AbortSignal;
    }): Promise<void> {
        try {
            await executeRun(input);
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
