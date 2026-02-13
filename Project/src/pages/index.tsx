export default function HomePage() {
    return (
        <main className='bg-obsidian-950 relative isolate flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-10 text-white'>
            <div className='pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-neon-400/18 blur-3xl' />
            <div className='pointer-events-none absolute right-12 bottom-10 h-60 w-60 rounded-full bg-electric-400/16 blur-3xl' />
            <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]' />

            <div className='relative w-full max-w-3xl rounded-[28px] bg-linear-to-br from-neon-400/45 via-electric-400/30 to-transparent p-px shadow-[0_28px_90px_-40px_rgba(96,165,250,0.8)]'>
                <section className='bg-obsidian-950/92 relative flex w-full flex-col items-center gap-6 overflow-hidden rounded-[27px] border border-white/10 px-8 py-11 text-center backdrop-blur-xl sm:px-12'>
                    <div className='pointer-events-none absolute inset-x-14 top-0 h-px bg-linear-to-r from-transparent via-white/65 to-transparent' />

                    <h1 className='font-display bg-linear-to-r from-neon-400 via-electric-400 to-neon-400 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl'>
                        NeonConductor
                    </h1>
                    <p className='text-electric-400 text-lg font-semibold tracking-[0.16em] sm:text-xl'>AI Agent Manager</p>
                    <p className='max-w-xl text-lg text-white/90 sm:text-xl'>This app is under construction</p>
                </section>
            </div>
        </main>
    );
}
