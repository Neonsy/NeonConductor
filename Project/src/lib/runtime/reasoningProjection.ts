import type { MessagePartRecord } from '@/app/backend/persistence/types';

export interface ConversationProjectionPart {
    id: string;
    role: 'assistant_text' | 'assistant_reasoning';
    text: string;
    providerLimitedReasoning: boolean;
}

function readPartText(part: MessagePartRecord): string | undefined {
    const value = part.payload['text'];
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function projectConversationParts(parts: MessagePartRecord[]): ConversationProjectionPart[] {
    const projected: ConversationProjectionPart[] = [];

    for (const part of parts) {
        if (part.partType === 'reasoning_encrypted') {
            continue;
        }

        const text = readPartText(part);
        if (!text) {
            continue;
        }

        if (part.partType === 'reasoning') {
            projected.push({
                id: part.id,
                role: 'assistant_reasoning',
                text,
                providerLimitedReasoning: false,
            });
            continue;
        }

        if (part.partType === 'reasoning_summary') {
            projected.push({
                id: part.id,
                role: 'assistant_reasoning',
                text,
                providerLimitedReasoning: true,
            });
            continue;
        }

        if (part.partType === 'text') {
            projected.push({
                id: part.id,
                role: 'assistant_text',
                text,
                providerLimitedReasoning: false,
            });
        }
    }

    return projected;
}

export function hasProviderLimitedReasoning(parts: MessagePartRecord[]): boolean {
    return projectConversationParts(parts).some((part) => part.providerLimitedReasoning);
}
