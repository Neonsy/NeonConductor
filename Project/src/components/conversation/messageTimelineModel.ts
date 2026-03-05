import { projectConversationParts } from '@/web/lib/runtime/reasoningProjection';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

export interface MessageTimelineBodyEntry {
    id: string;
    type: 'assistant_reasoning' | 'assistant_text' | 'user_text';
    text: string;
    providerLimitedReasoning: boolean;
}

export interface MessageTimelineEntry {
    id: string;
    role: MessageRecord['role'];
    createdAt: string;
    body: MessageTimelineBodyEntry[];
}

export interface BottomThresholdInput {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
    thresholdPx?: number;
}

const DEFAULT_BOTTOM_THRESHOLD_PX = 96;

function readTextPart(part: MessagePartRecord): string | null {
    const text = part.payload['text'];
    if (typeof text !== 'string') {
        return null;
    }

    const normalized = text.trim();
    return normalized.length > 0 ? normalized : null;
}

function buildBodyEntries(message: MessageRecord, parts: MessagePartRecord[]): MessageTimelineBodyEntry[] {
    if (message.role === 'assistant') {
        return projectConversationParts(parts).map((item) => ({
            id: item.id,
            type: item.role,
            text: item.text,
            providerLimitedReasoning: item.providerLimitedReasoning,
        }));
    }

    const projected: MessageTimelineBodyEntry[] = [];
    for (const part of parts) {
        const text = readTextPart(part);
        if (!text) {
            continue;
        }

        projected.push({
            id: part.id,
            type: message.role === 'user' ? 'user_text' : 'assistant_text',
            text,
            providerLimitedReasoning: false,
        });
    }

    return projected;
}

export function buildTimelineEntries(
    messages: MessageRecord[],
    partsByMessageId: Map<string, MessagePartRecord[]>
): MessageTimelineEntry[] {
    return messages.map((message) => {
        const parts = partsByMessageId.get(message.id) ?? [];
        return {
            id: message.id,
            role: message.role,
            createdAt: message.createdAt,
            body: buildBodyEntries(message, parts),
        };
    });
}

export function isWithinBottomThreshold({
    scrollHeight,
    scrollTop,
    clientHeight,
    thresholdPx = DEFAULT_BOTTOM_THRESHOLD_PX,
}: BottomThresholdInput): boolean {
    const distance = scrollHeight - scrollTop - clientHeight;
    return distance <= thresholdPx;
}
