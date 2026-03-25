import { describe, expect, it, vi } from 'vitest';

import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
    waitForRunStatus,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: provider selection fallback flows', () => {
    const profileId = runtimeContractProfileId;

    it('falls back to first runnable provider/model when defaults are not runnable', async () => {
        const caller = createCaller();
        const completionFetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => ({
                choices: [{ message: { content: 'Fallback provider response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 14, total_tokens: 24 },
            }),
        });
        vi.stubGlobal('fetch', completionFetchMock);

        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-test-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Provider fallback thread',
            kind: 'local',
        });

        const started = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Fallback provider run',
            topLevelTab: 'chat',
            modeKey: 'chat',
            runtimeOptions: defaultRuntimeOptions,
        });
        expect(started.accepted).toBe(true);
        if (!started.accepted) {
            throw new Error('Expected run start to be accepted.');
        }

        await waitForRunStatus(caller, profileId, created.session.id, 'completed');
        const runs = await caller.session.listRuns({ profileId, sessionId: created.session.id });
        const latestRun = runs.runs.at(0);
        expect(latestRun).toBeDefined();
        if (!latestRun) {
            throw new Error('Expected fallback run.');
        }
        expect(latestRun.providerId).toBe('openai');
    });

    it('fails closed when an explicit model is unavailable instead of falling back', async () => {
        const caller = createCaller();
        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-explicit-model-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Explicit unavailable model thread',
            kind: 'local',
        });

        const started = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Try the missing model',
            topLevelTab: 'chat',
            modeKey: 'chat',
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/not-a-real-model',
        });
        expect(started.accepted).toBe(false);
        if (started.accepted) {
            throw new Error('Expected explicit unavailable model to be rejected.');
        }
        expect(started.code).toBe('provider_model_not_available');
        expect(started.message).toContain('openai/not-a-real-model');
        expect(started.action).toEqual({
            code: 'model_unavailable',
            providerId: 'openai',
            modelId: 'openai/not-a-real-model',
        });
    });

    it('returns typed provider auth guidance when an explicit provider is not runnable', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Explicit unauthenticated provider thread',
            kind: 'local',
        });

        const started = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Try the disconnected provider',
            topLevelTab: 'chat',
            modeKey: 'chat',
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(started.accepted).toBe(false);
        if (started.accepted) {
            throw new Error('Expected unauthenticated provider to be rejected.');
        }
        expect(started.code).toBe('provider_not_authenticated');
        expect(started.action).toEqual({
            code: 'provider_not_runnable',
            providerId: 'openai',
        });
    });

    it('fails closed on invalid runtime options combinations', async () => {
        const caller = createCaller();
        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-test-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Invalid Runtime Options Thread',
            kind: 'local',
        });

        await expect(
            caller.session.startRun({
                profileId,
                sessionId: created.session.id,
                prompt: 'Invalid manual cache',
                topLevelTab: 'chat',
                modeKey: 'chat',
                runtimeOptions: {
                    reasoning: {
                        effort: 'none',
                        summary: 'none',
                        includeEncrypted: false,
                    },
                    cache: {
                        strategy: 'manual',
                    },
                    transport: {
                        family: 'auto',
                    },
                },
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        ).rejects.toThrow('runtimeOptions.cache.key');
    });
});
