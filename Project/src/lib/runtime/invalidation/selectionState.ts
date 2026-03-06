import { isEntityId } from '@/web/components/conversation/shellHelpers';
import type { ConversationSelectionState } from '@/web/lib/runtime/invalidation/types';

function emptySelectionState(): ConversationSelectionState {
    return {
        selectedSessionId: undefined,
        selectedRunId: undefined,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function readConversationSelectionState(profileId: string | undefined): ConversationSelectionState {
    if (!profileId || typeof window === 'undefined') {
        return emptySelectionState();
    }

    const raw = window.localStorage.getItem(`neonconductor.conversation.ui.${profileId}`);
    if (!raw) {
        return emptySelectionState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return emptySelectionState();
        }

        const selectedSessionId = readString(parsed['selectedSessionId']);
        const selectedRunId = readString(parsed['selectedRunId']);
        return {
            selectedSessionId: isEntityId(selectedSessionId, 'sess') ? selectedSessionId : undefined,
            selectedRunId: isEntityId(selectedRunId, 'run') ? selectedRunId : undefined,
        };
    } catch {
        return emptySelectionState();
    }
}
