import { trpc } from '@/web/trpc/client';

const ACTIVE_PHASES = new Set(['checking', 'downloading', 'downloaded']);

export default function UpdateSwitchModal() {
    const { data: status } = trpc.updates.getSwitchStatus.useQuery(undefined, {
        refetchInterval: (query) => {
            const phase = query.state.data?.phase;
            return phase && ACTIVE_PHASES.has(phase) ? 300 : false;
        },
        refetchIntervalInBackground: true,
    });

    if (!status || !ACTIVE_PHASES.has(status.phase)) {
        return null;
    }

    const progress =
        status.phase === 'downloading' ? Math.max(0, Math.min(100, Math.round(status.percent ?? 0))) : null;

    return (
        <div className='bg-background/65 fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-sm'>
            <section className='border-border bg-card/95 text-card-foreground w-full max-w-md rounded-xl border p-6 shadow-xl'>
                <p className='text-primary text-xs font-semibold tracking-[0.2em] uppercase'>Updating Channel</p>
                <h2 className='mt-3 text-lg font-semibold'>{status.message || 'Preparing update...'}</h2>
                <p className='text-muted-foreground mt-2 text-sm'>
                    Please wait while NeonConductor prepares the selected release channel.
                </p>

                <div className='bg-muted mt-5 h-2 w-full overflow-hidden rounded-full'>
                    <div
                        className='bg-primary h-full rounded-full transition-[width] duration-150 ease-linear'
                        style={{ width: `${String(progress ?? (status.phase === 'downloaded' ? 100 : 20))}%` }}
                    />
                </div>

                <div className='text-muted-foreground mt-3 text-right text-xs font-medium'>
                    {progress === null ? 'Working...' : `${String(progress)}%`}
                </div>
            </section>
        </div>
    );
}
