export default function HomePage() {
    return (
        <main
            className="relative isolate grid w-full flex-1 place-items-center overflow-hidden p-[clamp(1rem,3vw,2.5rem)] text-[#e8f1ff] before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,rgba(180,210,255,0.08)_0,rgba(180,210,255,0.08)_1px,transparent_1px,transparent_4px),repeating-linear-gradient(90deg,rgba(180,210,255,0.05)_0,rgba(180,210,255,0.05)_1px,transparent_1px,transparent_5px)] before:opacity-[0.14] before:[mix-blend-mode:soft-light] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(130%_96%_at_50%_112%,transparent_52%,rgba(0,0,0,0.44)_100%)] after:content-['']"
            style={{
                background:
                    'radial-gradient(120% 95% at 8% -4%, rgba(36, 123, 255, 0.2) 0%, transparent 52%), radial-gradient(110% 90% at 95% 106%, rgba(0, 208, 255, 0.16) 0%, transparent 56%), linear-gradient(150deg, #01030a 0%, #020916 46%, #02050d 100%)',
            }}>
            <div
                aria-hidden
                className='absolute top-[-31vh] left-[-12vw] h-[40vh] w-[min(110vw,1500px)] animate-[arc-drift_18s_ease-in-out_infinite] rounded-full border border-[rgba(130,214,255,0.28)] bg-[radial-gradient(ellipse_at_center,rgba(45,170,255,0.16)_0%,rgba(45,170,255,0)_72%)] opacity-[0.46] blur-[2px] motion-reduce:animate-none'
            />
            <div
                aria-hidden
                className='absolute right-[-8vw] bottom-[-29vh] h-[40vh] w-[min(110vw,1500px)] animate-[arc-drift_18s_ease-in-out_infinite] rounded-full border border-[rgba(130,214,255,0.28)] bg-[radial-gradient(ellipse_at_center,rgba(10,145,255,0.14)_0%,rgba(10,145,255,0)_74%)] opacity-[0.46] blur-[2px] [animation-delay:-9s] motion-reduce:animate-none'
            />
            <div
                aria-hidden
                className='absolute top-[-22%] left-[-18%] aspect-square w-[min(54vw,680px)] animate-[neon-drift_16s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(39,154,255,0.78)_0%,rgba(39,154,255,0)_68%)] opacity-[0.64] blur-[82px] motion-reduce:animate-none'
            />
            <div
                aria-hidden
                className='absolute right-[-16%] bottom-[-28%] aspect-square w-[min(54vw,680px)] animate-[neon-drift_16s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(0,195,255,0.62)_0%,rgba(0,195,255,0)_72%)] opacity-[0.64] blur-[82px] [animation-delay:-7s] motion-reduce:animate-none'
            />

            <section className='relative isolate z-10 w-[min(100%,820px)] animate-[neon-pulse_7s_ease-in-out_infinite] overflow-hidden rounded-[34px] border border-[rgba(160,220,255,0.28)] bg-[rgba(5,14,32,0.9)] p-[clamp(1.55rem,4.6vw,3.2rem)] text-center backdrop-blur-[8px] motion-reduce:animate-none max-[700px]:rounded-[24px] max-[700px]:p-[1.25rem_1rem_1.35rem]'>
                <h1 className='relative z-10 m-0 [font-family:var(--font-display)] text-[clamp(2.2rem,9vw,5rem)] leading-[0.95] font-black tracking-[-0.035em] text-[#ecf6ff] [text-shadow:0_0_14px_rgba(120,223,255,0.35),0_0_42px_rgba(40,136,255,0.3)]'>
                    NeonConductor
                </h1>
                <p className='relative z-10 mt-[clamp(0.55rem,2.4vw,1rem)] font-mono text-[clamp(0.86rem,2.4vw,1.03rem)] tracking-[0.2em] text-[rgba(126,224,255,0.86)] uppercase'>
                    Work In Progress
                </p>
                <p className='relative z-10 mx-auto mt-[clamp(0.72rem,2.5vw,1.05rem)] max-w-[52ch] [font-family:var(--font-display)] text-[clamp(1rem,2.5vw,1.15rem)] leading-[1.6] font-[460] text-[rgba(210,230,255,0.9)]'>
                    This is the starting point, the foundation that will be built upon
                </p>
            </section>
        </main>
    );
}
