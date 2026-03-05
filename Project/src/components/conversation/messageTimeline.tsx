import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';

interface MessageTimelineItemProps {
    entry: MessageTimelineEntry;
}

export function MessageTimelineEmptyState() {
    return (
        <div className='text-muted-foreground border-border bg-card/60 rounded-lg border p-4 text-sm'>
            No messages yet for this session.
        </div>
    );
}

export function MessageTimelineItem({ entry }: MessageTimelineItemProps) {
    return (
        <article className='border-border bg-card rounded-lg border p-3'>
            <header className='mb-2 flex items-center gap-2'>
                <span className='bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'>
                    {entry.role}
                </span>
                <span className='text-muted-foreground text-xs'>{new Date(entry.createdAt).toLocaleTimeString()}</span>
            </header>
            <div className='space-y-2 text-sm leading-relaxed'>
                {entry.body.length > 0 ? (
                    entry.body.map((item) => (
                        <div key={item.id} className='space-y-1'>
                            {item.type === 'assistant_reasoning' ? (
                                <div className='text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase'>
                                    Reasoning
                                    {item.providerLimitedReasoning ? (
                                        <span className='text-muted-foreground text-[10px] tracking-normal lowercase'>provider-limited</span>
                                    ) : null}
                                </div>
                            ) : null}
                            <p className='whitespace-pre-wrap'>{item.text}</p>
                        </div>
                    ))
                ) : (
                    <p className='text-muted-foreground'>No renderable text payload.</p>
                )}
            </div>
        </article>
    );
}
