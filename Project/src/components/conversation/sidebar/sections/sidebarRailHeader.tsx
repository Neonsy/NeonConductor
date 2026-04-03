import { PanelLeftClose } from 'lucide-react';

import type { ReactNode } from 'react';

interface SidebarRailHeaderProps {
    compact?: boolean;
    workspaceCount: number;
    threadCount: number;
    sessionCount: number;
    selectedWorkspaceLabel?: string;
    selectedThreadTitle?: string;
    feedbackMessage?: string;
    statusMessage?: string;
    statusTone?: 'info' | 'error';
    primaryAction: ReactNode;
    onToggleCollapsed: () => void;
}

export function SidebarRailHeader({
    compact = false,
    workspaceCount,
    threadCount,
    sessionCount,
    selectedWorkspaceLabel,
    selectedThreadTitle,
    feedbackMessage,
    statusMessage,
    statusTone = 'info',
    primaryAction,
    onToggleCollapsed,
}: SidebarRailHeaderProps) {
    if (compact) {
        return (
            <div className='border-border/70 flex flex-col items-center gap-3 border-b px-3 py-3'>
                {primaryAction}
            </div>
        );
    }

    const summaryItems = [
        `${String(workspaceCount)} workspace${workspaceCount === 1 ? '' : 's'}`,
        `${String(threadCount)} thread${threadCount === 1 ? '' : 's'}`,
        `${String(sessionCount)} session${sessionCount === 1 ? '' : 's'}`,
    ];

    return (
        <div className='border-border/70 bg-background/75 space-y-3 border-b p-4 backdrop-blur-sm'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-1'>
                    <p className='text-[11px] font-semibold tracking-[0.22em] uppercase'>Sessions</p>
                    <p className='text-muted-foreground text-xs leading-5'>
                        Workspace tree, thread rail, and run state in one place.
                    </p>
                </div>
                <button
                    type='button'
                    className='border-border bg-card hover:bg-accent inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors'
                    aria-label='Collapse threads sidebar'
                    title='Collapse threads sidebar'
                    onClick={onToggleCollapsed}>
                    <PanelLeftClose className='h-4 w-4' />
                </button>
            </div>

            <div className='flex flex-wrap gap-2'>
                {summaryItems.map((item) => (
                    <span
                        key={item}
                        className='border-border/70 bg-card/70 text-muted-foreground rounded-full border px-2.5 py-1 text-[11px] font-medium'>
                        {item}
                    </span>
                ))}
            </div>

            {selectedWorkspaceLabel || selectedThreadTitle ? (
                <div className='border-border/70 bg-card/60 rounded-2xl border px-3 py-2 text-xs'>
                    <p className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                        Current focus
                    </p>
                    <p className='mt-1 line-clamp-1 font-medium'>
                        {selectedThreadTitle ?? selectedWorkspaceLabel ?? 'Workspace overview'}
                    </p>
                </div>
            ) : null}

            <div>{primaryAction}</div>

            {feedbackMessage ? (
                <div
                    aria-live='polite'
                    className='border-destructive/20 bg-destructive/10 text-destructive rounded-2xl border px-3 py-2 text-xs'>
                    {feedbackMessage}
                </div>
            ) : null}
            {statusMessage ? (
                <div
                    aria-live='polite'
                    className={`rounded-2xl px-3 py-2 text-xs ${
                        statusTone === 'error'
                            ? 'border-destructive/20 bg-destructive/10 text-destructive border'
                            : 'border-border/70 bg-background/80 text-muted-foreground border'
                    }`}>
                    {statusMessage}
                </div>
            ) : null}
        </div>
    );
}
