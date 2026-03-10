import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';
import { createTextPart } from '@/app/backend/runtime/services/runExecution/contextParts';
import type { RunContextMessage, RunContextPart } from '@/app/backend/runtime/services/runExecution/types';
import { readImageMimeType } from '@/app/shared/imageMimeType';

export interface ReplayMessage {
    messageId: MessageRecord['id'];
    role: RunContextMessage['role'];
    parts: RunContextPart[];
}

export function toPartsMap(parts: MessagePartRecord[]): Map<string, MessagePartRecord[]> {
    const map = new Map<string, MessagePartRecord[]>();
    for (const part of parts) {
        const existing = map.get(part.messageId) ?? [];
        existing.push(part);
        map.set(part.messageId, existing);
    }
    return map;
}

function mapRole(role: MessageRecord['role']): RunContextMessage['role'] | null {
    if (role === 'user') {
        return 'user';
    }
    if (role === 'assistant') {
        return 'assistant';
    }
    if (role === 'system') {
        return 'system';
    }
    return null;
}

function extractReplayParts(parts: MessagePartRecord[]): RunContextPart[] {
    const replayParts: RunContextPart[] = [];
    for (const part of parts) {
        if (part.partType === 'image') {
            const mediaId = part.payload['mediaId'];
            const mimeType = part.payload['mimeType'];
            const width = part.payload['width'];
            const height = part.payload['height'];
            const normalizedMimeType = readImageMimeType(mimeType);
            if (
                typeof mediaId === 'string' &&
                normalizedMimeType &&
                typeof width === 'number' &&
                typeof height === 'number'
            ) {
                replayParts.push({
                    type: 'image',
                    mediaId,
                    mimeType: normalizedMimeType,
                    width,
                    height,
                });
            }
            continue;
        }

        const text = typeof part.payload['text'] === 'string' ? part.payload['text'] : '';
        const textPart = createTextPart(text);
        if (textPart) {
            replayParts.push(textPart);
        }
    }

    return replayParts;
}

export function buildReplayMessages(input: {
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
}): ReplayMessage[] {
    const replay: ReplayMessage[] = [];
    for (const message of input.messages) {
        const role = mapRole(message.role);
        if (!role) {
            continue;
        }
        const parts = extractReplayParts(input.partsByMessageId.get(message.id) ?? []);
        if (parts.length === 0) {
            continue;
        }
        replay.push({
            messageId: message.id,
            role,
            parts,
        });
    }

    return replay;
}
