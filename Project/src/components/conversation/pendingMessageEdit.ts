import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';
import type { PendingMessageEdit } from '@/web/components/conversation/shellEditFlow';
import { isEntityId } from '@/web/components/conversation/shellHelpers';

export function createPendingMessageEdit(
    entry: MessageTimelineEntry,
    forcedMode?: PendingMessageEdit['forcedMode']
): PendingMessageEdit | undefined {
    if (!isEntityId(entry.id, 'msg')) {
        return undefined;
    }

    const editableText = entry.editableText?.trim();
    if (!editableText) {
        return undefined;
    }

    return {
        messageId: entry.id,
        initialText: editableText,
        ...(forcedMode ? { forcedMode } : {}),
    };
}
