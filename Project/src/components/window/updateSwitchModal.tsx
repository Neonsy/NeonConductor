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
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm'>
            <section className='bg-obsidian-900/95 w-full max-w-md rounded-xl border border-white/12 p-6 shadow-2xl shadow-black/50'>
                <p className='text-neon-400 text-xs font-semibold tracking-[0.2em] uppercase'>Updating Channel</p>
                <h2 className='mt-3 text-lg font-semibold text-white'>{status.message || 'Preparing update...'}</h2>
                <p className='mt-2 text-sm text-white/65'>
                    Please wait while NeonConductor prepares the selected release channel.
                </p>

                <div className='mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10'>
                    <div
                        className='bg-electric-400 h-full rounded-full transition-[width] duration-150 ease-linear'
                        style={{ width: `${String(progress ?? (status.phase === 'downloaded' ? 100 : 20))}%` }}
                    />
                </div>

                <div className='mt-3 text-right text-xs font-medium text-white/70'>
                    {progress === null ? 'Working...' : `${String(progress)}%`}
                </div>
            </section>
        </div>
    );
}
