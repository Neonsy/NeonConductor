import { MessageTimeline } from '@/web/components/conversation/messageTimeline';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

interface MessageTimelinePanelProps {
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
}

export function MessageTimelinePanel({ messages, partsByMessageId }: MessageTimelinePanelProps) {
    return (
        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
            <MessageTimeline messages={messages} partsByMessageId={partsByMessageId} />
        </div>
    );
}
