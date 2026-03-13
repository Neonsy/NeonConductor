import { describe, expect, it } from 'vitest';

import { projectConversationTanstackMessages } from '@/web/components/conversation/messages/tanstackMessageBridge';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

function createMessage(input: {
    id: string;
    role: MessageRecord['role'];
    runId?: string;
    createdAt?: string;
}): MessageRecord {
    const createdAt = input.createdAt ?? '2026-01-01T00:00:00.000Z';

    return {
        id: input.id as MessageRecord['id'],
        profileId: 'profile_test',
        sessionId: 'sess_test' as MessageRecord['sessionId'],
        runId: (input.runId ?? 'run_test') as MessageRecord['runId'],
        role: input.role,
        createdAt,
        updatedAt: createdAt,
    };
}

function createPart(input: {
    id: string;
    messageId: string;
    partType: MessagePartRecord['partType'];
    payload: Record<string, unknown>;
    sequence?: number;
}): MessagePartRecord {
    return {
        id: input.id as MessagePartRecord['id'],
        messageId: input.messageId as MessagePartRecord['messageId'],
        sequence: input.sequence ?? 0,
        partType: input.partType,
        payload: input.payload,
        createdAt: '2026-01-01T00:00:00.000Z',
    };
}

describe('tanstack message bridge', () => {
    it('projects backend reasoning, tool calls, and tool results into TanStack-friendly ui messages', () => {
        const assistantMessage = createMessage({ id: 'msg_assistant', role: 'assistant' });
        const toolMessage = createMessage({ id: 'msg_tool', role: 'tool' });

        const projected = projectConversationTanstackMessages(
            [assistantMessage, toolMessage],
            new Map([
                [
                    assistantMessage.id,
                    [
                        createPart({
                            id: 'part_reasoning',
                            messageId: assistantMessage.id,
                            partType: 'reasoning_summary',
                            payload: { text: 'Reasoning summary' },
                        }),
                        createPart({
                            id: 'part_text',
                            messageId: assistantMessage.id,
                            partType: 'text',
                            payload: { text: 'Assistant answer' },
                        }),
                        createPart({
                            id: 'part_tool_call',
                            messageId: assistantMessage.id,
                            partType: 'tool_call',
                            payload: {
                                callId: 'call_1',
                                toolName: 'search_workspace',
                                argumentsText: '{"query":"tanstack"}',
                            },
                        }),
                    ],
                ],
                [
                    toolMessage.id,
                    [
                        createPart({
                            id: 'part_tool_result',
                            messageId: toolMessage.id,
                            partType: 'tool_result',
                            payload: {
                                callId: 'call_1',
                                toolName: 'search_workspace',
                                outputText: '{"ok":true}',
                                isError: false,
                            },
                        }),
                    ],
                ],
            ])
        );

        expect(projected[0]?.uiMessage.role).toBe('assistant');
        expect(projected[0]?.uiMessage.parts.map((part) => part.type)).toEqual(['thinking', 'text', 'tool-call']);
        expect(projected[1]?.role).toBe('tool');
        expect(projected[1]?.uiMessage.role).toBe('assistant');
        expect(projected[1]?.uiMessage.parts[0]).toMatchObject({
            type: 'tool-result',
            toolCallId: 'call_1',
            content: '{"ok":true}',
            state: 'complete',
        });
    });
});
