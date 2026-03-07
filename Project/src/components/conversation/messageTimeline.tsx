import { RichContentBlocks } from '@/web/components/content/richContent';
import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';

interface MessageTimelineItemProps {
    entry: MessageTimelineEntry;
    canBranch: boolean;
    onEditMessage?: (entry: MessageTimelineEntry) => void;
    onBranchFromMessage?: (entry: MessageTimelineEntry) => void;
}

export function MessageTimelineEmptyState() {
    return (
        <div className='text-muted-foreground border-border bg-card/60 rounded-xl border p-5 text-sm'>
            No messages yet for this session. Start a run to populate the timeline.
        </div>
    );
}

export function MessageTimelineItem({
    entry,
    canBranch,
    onEditMessage,
    onBranchFromMessage,
}: MessageTimelineItemProps) {
    const canEdit = entry.role === 'user' && typeof entry.editableText === 'string' && entry.editableText.length > 0;

    return (
        <article className='border-border bg-card rounded-xl border p-4 shadow-sm'>
            <header className='mb-2 flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                    <span className='bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'>
                        {entry.role}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                        {new Date(entry.createdAt).toLocaleTimeString()}
                    </span>
                </div>
                {canEdit ? (
                    <div className='flex items-center gap-1'>
                        <button
                            type='button'
                            className='border-border bg-background hover:bg-accent rounded border px-2 py-0.5 text-[11px]'
                            onClick={() => {
                                onEditMessage?.(entry);
                            }}>
                            Edit
                        </button>
                        {canBranch ? (
                            <button
                                type='button'
                                className='border-border bg-background hover:bg-accent rounded border px-2 py-0.5 text-[11px]'
                                onClick={() => {
                                    onBranchFromMessage?.(entry);
                                }}>
                                Branch
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </header>
            <div className='space-y-3'>
                {entry.body.length > 0 ? (
                    entry.body.map((item) => (
                        <div key={item.id} className='space-y-2'>
                            {item.type === 'assistant_reasoning' ? (
                                <div className='text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase'>
                                    Reasoning
                                    {item.providerLimitedReasoning ? (
                                        <span className='text-muted-foreground text-[10px] tracking-normal lowercase'>
                                            provider-limited
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                            <RichContentBlocks blocks={item.blocks} />
                        </div>
                    ))
                ) : (
                    <p className='text-muted-foreground'>No renderable text payload.</p>
                )}
            </div>
        </article>
    );
}
