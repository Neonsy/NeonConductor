import { createHash } from 'node:crypto';

import { messageStore } from '@/app/backend/persistence/stores';
import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';
import type { ChatContextMessage } from '@/app/backend/runtime/services/runExecution/types';

const MAX_CONTEXT_MESSAGES = 40;
const MAX_CONTEXT_CHARS = 120_000;

function toPartsMap(parts: MessagePartRecord[]): Map<string, MessagePartRecord[]> {
    const map = new Map<string, MessagePartRecord[]>();
    for (const part of parts) {
        const existing = map.get(part.messageId) ?? [];
        existing.push(part);
        map.set(part.messageId, existing);
    }
    return map;
}

function mapRole(role: MessageRecord['role']): ChatContextMessage['role'] | null {
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

function extractText(parts: MessagePartRecord[]): string {
    const segments: string[] = [];
    for (const part of parts) {
        const text = part.payload['text'];
        if (typeof text !== 'string') {
            continue;
        }
        const normalized = text.trim();
        if (normalized.length === 0) {
            continue;
        }
        segments.push(normalized);
    }

    return segments.join('\n\n').trim();
}

function buildDigest(messages: ChatContextMessage[]): string {
    const hash = createHash('sha256');
    for (const message of messages) {
        hash.update(message.role);
        hash.update('|');
        hash.update(message.text);
        hash.update('\n');
    }
    return `chatctx-${hash.digest('hex').slice(0, 32)}`;
}

function trimContext(messages: ChatContextMessage[]): ChatContextMessage[] {
    if (messages.length <= MAX_CONTEXT_MESSAGES) {
        const totalChars = messages.reduce((sum, message) => sum + message.text.length, 0);
        if (totalChars <= MAX_CONTEXT_CHARS) {
            return messages;
        }
    }

    const trimmed: ChatContextMessage[] = [];
    let runningChars = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message) {
            continue;
        }
        if (trimmed.length >= MAX_CONTEXT_MESSAGES) {
            break;
        }

        const nextChars = runningChars + message.text.length;
        if (nextChars > MAX_CONTEXT_CHARS && trimmed.length > 0) {
            break;
        }

        trimmed.push(message);
        runningChars = nextChars;
    }

    return trimmed.reverse();
}

export async function buildChatReplayContext(input: {
    profileId: string;
    sessionId: string;
    prompt: string;
}): Promise<{ messages: ChatContextMessage[]; digest: string }> {
    const [messages, parts] = await Promise.all([
        messageStore.listMessagesBySession(input.profileId, input.sessionId),
        messageStore.listPartsBySession(input.profileId, input.sessionId),
    ]);

    const partsByMessageId = toPartsMap(parts);
    const replay: ChatContextMessage[] = [];
    for (const message of messages) {
        const role = mapRole(message.role);
        if (!role) {
            continue;
        }
        const text = extractText(partsByMessageId.get(message.id) ?? []);
        if (!text) {
            continue;
        }
        replay.push({ role, text });
    }

    replay.push({
        role: 'user',
        text: input.prompt.trim(),
    });

    const normalized = trimContext(replay);
    return {
        messages: normalized,
        digest: buildDigest(normalized),
    };
}
