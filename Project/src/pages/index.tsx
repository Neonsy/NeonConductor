import { Button } from '@/web/components/ui/button';

export default function HomePage() {
    return (
        <main className='bg-background flex w-full flex-1 items-center justify-center px-4 py-6 sm:px-6'>
            <section className='border-border bg-card text-card-foreground clamp-[p,4,8] w-full max-w-4xl rounded-lg border shadow-sm'>
                <p className='text-primary clamp-[text,xs,sm] font-mono tracking-[0.2em] uppercase'>Work In Progress</p>
                <h1 className='font-display clamp-[text,4xl,7xl] mt-2 font-black tracking-[-0.03em]'>NeonConductor</h1>
                <p className='text-muted-foreground clamp-[text,sm,lg] mt-3 max-w-[60ch]'>
                    Foundation runtime and provider architecture is in place. P3 now focuses on conversation graph,
                    projection UX, and window-system modernization.
                </p>
                <div className='mt-5 flex flex-wrap items-center gap-2'>
                    <span className='border-border bg-secondary text-secondary-foreground rounded-md border px-2 py-1 text-xs font-medium'>
                        Vite + Electron
                    </span>
                    <span className='border-border bg-secondary text-secondary-foreground rounded-md border px-2 py-1 text-xs font-medium'>
                        Tailwind First
                    </span>
                    <span className='border-border bg-secondary text-secondary-foreground rounded-md border px-2 py-1 text-xs font-medium'>
                        Backend Authority
                    </span>
                    <Button size='sm' variant='outline' className='ml-auto'>
                        Foundation Build
                    </Button>
                </div>
            </section>
        </main>
    );
}
