import { describe, expect, it } from 'vitest';

import {
    isNeonObservabilityEvent,
    isRuntimeEventRecord,
    isSubscriptionControlPayload,
    isWindowStateEvent,
    normalizeSubscriptionPayload,
} from '@/web/lib/providers/subscriptionPayloads';

describe('subscriptionPayloads', () => {
    it('treats nullish subscription lifecycle values as control payloads', () => {
        expect(isSubscriptionControlPayload(undefined)).toBe(true);
        expect(isSubscriptionControlPayload(null)).toBe(true);
        expect(isSubscriptionControlPayload({ type: 'started' })).toBe(true);
        expect(isSubscriptionControlPayload({ type: 'state', state: 'connecting' })).toBe(true);
        expect(isSubscriptionControlPayload({})).toBe(false);
    });

    it('unwraps leaked subscription envelopes before classification', () => {
        expect(
            normalizeSubscriptionPayload({
                result: {
                    type: 'started',
                },
            })
        ).toEqual({
            type: 'started',
        });
        expect(
            normalizeSubscriptionPayload({
                result: {
                    data: {
                        sequence: 1,
                    },
                },
            })
        ).toEqual({
            sequence: 1,
        });
        expect(
            normalizeSubscriptionPayload({
                id: 'tracked_runtime_stream',
                data: {
                    sequence: 2,
                },
            })
        ).toEqual({
            sequence: 2,
        });
        expect(
            normalizeSubscriptionPayload({
                result: {
                    data: {
                        id: 'tracked_runtime_stream',
                        data: {
                            sequence: 3,
                        },
                    },
                },
            })
        ).toEqual({
            sequence: 3,
        });
        expect(
            normalizeSubscriptionPayload({
                data: {
                    sequence: 4,
                },
            })
        ).toEqual({
            sequence: 4,
        });
    });

    it('recognizes runtime event records with object payloads', () => {
        expect(
            isRuntimeEventRecord({
                sequence: 1,
                eventId: 'evt_1',
                entityType: 'profile',
                domain: 'profile',
                operation: 'upsert',
                entityId: 'profile_default',
                eventType: 'profile.updated',
                payload: {},
                createdAt: '2026-03-23T16:00:00.000Z',
            })
        ).toBe(true);
        expect(isRuntimeEventRecord(undefined)).toBe(false);
    });

    it('recognizes window state events with boolean state fields', () => {
        expect(
            isWindowStateEvent({
                sequence: 1,
                state: {
                    isMaximized: false,
                    isFullScreen: false,
                    canMaximize: true,
                    canMinimize: true,
                    platform: 'win32',
                },
            })
        ).toBe(true);
        expect(isWindowStateEvent(undefined)).toBe(false);
    });

    it('recognizes Neon observability events with shared metadata fields', () => {
        expect(
            isNeonObservabilityEvent({
                sequence: 1,
                at: '2026-03-25T16:00:00.000Z',
                kind: 'stream_chunk',
                profileId: 'profile_default',
                sessionId: 'sess_alpha',
                runId: 'run_alpha',
                providerId: 'openai',
                modelId: 'gpt-test',
                source: 'provider.stream',
                chunk: {
                    kind: 'text_delta',
                    text: 'hello',
                },
            })
        ).toBe(true);
        expect(isNeonObservabilityEvent(undefined)).toBe(false);
    });
});
