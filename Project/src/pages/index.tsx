import {
    VscBeaker,
    VscCode,
    VscDatabase,
    VscExtensions,
    VscFlame,
    VscLayers,
    VscPackage,
    VscPlug,
    VscRocket,
    VscServer,
    VscShield,
    VscSymbolClass,
    VscTerminal,
} from 'react-icons/vsc';

import type { IconType } from 'react-icons';

interface FeatureCard {
    name: string;
    desc: string;
    icon: IconType;
    gradient: string;
    tag?: string;
}

const coreStack: FeatureCard[] = [
    {
        name: 'TanStack Router',
        desc: 'File-based routing with hash history for Electron',
        icon: VscSymbolClass,
        gradient: 'from-electric-500 to-neon-500',
    },
    {
        name: 'TanStack Query',
        desc: 'Powerful data fetching, caching & synchronization',
        icon: VscServer,
        gradient: 'from-neon-500 to-coral-500',
    },
    {
        name: 'TanStack Form',
        desc: 'Performant, type-safe form state management',
        icon: VscCode,
        gradient: 'from-coral-500 to-mint-500',
    },
    {
        name: 'TanStack Virtual',
        desc: 'Virtualized lists for massive datasets',
        icon: VscLayers,
        gradient: 'from-mint-500 to-electric-500',
    },
    {
        name: 'tRPC + IPC',
        desc: 'Type-safe main↔renderer communication',
        icon: VscPlug,
        gradient: 'from-electric-500 to-coral-500',
    },
    {
        name: 'Zustand + Mutative',
        desc: 'Lightning-fast state with immutable updates',
        icon: VscFlame,
        gradient: 'from-amber-400 to-orange-500',
    },
    {
        name: 'ArkType',
        desc: 'Blazing fast TypeScript-first validation',
        icon: VscShield,
        gradient: 'from-emerald-400 to-teal-500',
    },
    {
        name: 'Vitest',
        desc: 'Vite-native, Jest-compatible test runner',
        icon: VscBeaker,
        gradient: 'from-lime-400 to-green-500',
    },
    {
        name: 'TailwindCSS v4',
        desc: 'Next-gen utility-first styling',
        icon: VscRocket,
        gradient: 'from-neon-500 to-mint-500',
    },
];

const keyFiles = [
    { path: 'electron/main.ts', desc: 'Main process entry', color: 'text-electric-400' },
    { path: 'electron/backend/trpc/*', desc: 'tRPC routers', color: 'text-neon-400' },
    { path: 'src/routes/', desc: 'File-based routes', color: 'text-mint-400' },
    { path: 'src/lib/providers/*', desc: 'React Query + tRPC', color: 'text-coral-400' },
];

const codeExample = `import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

const useStore = create(
  mutative((set) => ({
    count: 0,
    increment: () => set((s) => { s.count++ }),
  }))
);`;

export default function HomePage() {
    return (
        <div className='bg-obsidian-950 relative min-h-screen overflow-hidden text-white'>
            {/* Fixed space background */}
            <div className='pointer-events-none fixed inset-0'>
                {/* Heavily blurred gradient container */}
                <div className='absolute inset-0 blur-[120px]'>
                    {/* Deep dark blue with subtle cyan undertone - top left */}
                    <div
                        className='absolute -top-[20%] -left-[15%] h-[100vh] w-[100vw] rounded-full'
                        style={{
                            background:
                                'radial-gradient(circle, rgba(20,50,90,0.8) 0%, rgba(20,50,90,0.7) 10%, rgba(20,50,90,0.55) 20%, rgba(20,50,90,0.4) 30%, rgba(20,50,90,0.28) 40%, rgba(20,50,90,0.18) 50%, rgba(20,50,90,0.1) 60%, rgba(20,50,90,0.04) 70%, rgba(20,50,90,0) 80%)',
                        }}
                    />
                    {/* Deep space navy - bottom right */}
                    <div
                        className='absolute -right-[15%] -bottom-[20%] h-[110vh] w-[110vw] rounded-full'
                        style={{
                            background:
                                'radial-gradient(circle, rgba(15,25,55,0.9) 0%, rgba(15,25,55,0.78) 10%, rgba(15,25,55,0.6) 20%, rgba(15,25,55,0.45) 30%, rgba(15,25,55,0.32) 40%, rgba(15,25,55,0.2) 50%, rgba(15,25,55,0.1) 60%, rgba(15,25,55,0.04) 70%, rgba(15,25,55,0) 80%)',
                        }}
                    />
                    {/* Near-black purple - top right */}
                    <div
                        className='absolute -top-[15%] -right-[20%] h-[90vh] w-[90vw] rounded-full'
                        style={{
                            background:
                                'radial-gradient(circle, rgba(40,20,60,0.7) 0%, rgba(40,20,60,0.6) 10%, rgba(40,20,60,0.48) 20%, rgba(40,20,60,0.36) 30%, rgba(40,20,60,0.25) 40%, rgba(40,20,60,0.16) 50%, rgba(40,20,60,0.08) 60%, rgba(40,20,60,0.03) 70%, rgba(40,20,60,0) 80%)',
                        }}
                    />
                    {/* Dark purple - bottom left */}
                    <div
                        className='absolute -bottom-[15%] -left-[20%] h-[95vh] w-[95vw] rounded-full'
                        style={{
                            background:
                                'radial-gradient(circle, rgba(60,30,90,0.65) 0%, rgba(60,30,90,0.55) 10%, rgba(60,30,90,0.44) 20%, rgba(60,30,90,0.33) 30%, rgba(60,30,90,0.23) 40%, rgba(60,30,90,0.14) 50%, rgba(60,30,90,0.07) 60%, rgba(60,30,90,0.02) 70%, rgba(60,30,90,0) 80%)',
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className='relative z-10 mx-auto max-w-7xl px-6 py-16 lg:py-24'>
                {/* Hero Section */}
                <header className='mb-32 text-center'>
                    <div className='animate-slide-up mb-10 flex items-center justify-center'>
                        <div className='animate-float relative'>
                            <div className='from-electric-500/30 via-neon-500/20 to-mint-500/30 absolute -inset-4 rounded-3xl bg-gradient-to-br blur-2xl' />
                            <div className='glass-card relative rounded-2xl p-6'>
                                <VscTerminal className='h-16 w-16 text-white' />
                            </div>
                        </div>
                    </div>

                    <h1 className='animate-slide-up mb-8 text-6xl font-extrabold tracking-tight delay-100 lg:text-8xl'>
                        <span className='text-gradient-electric'>Electron</span>
                        <span className='mx-4 text-white/20'>×</span>
                        <span className='text-white'>Vite</span>
                    </h1>

                    <p className='animate-slide-up font-display mx-auto max-w-3xl text-xl leading-relaxed text-white/50 delay-200 lg:text-2xl'>
                        Production-ready desktop apps with{' '}
                        <span className='text-electric-400 font-semibold'>type-safe IPC</span>,{' '}
                        <span className='text-neon-400 font-semibold'>TanStack ecosystem</span>, and{' '}
                        <span className='text-mint-400 font-semibold'>modern tooling</span>.
                    </p>

                    {/* Version badges */}
                    <div className='animate-slide-up mt-12 flex flex-wrap items-center justify-center gap-3 delay-300'>
                        {[
                            { name: 'TypeScript 5.9', color: 'bg-blue-500/20 text-blue-300' },
                            { name: 'React 19', color: 'bg-cyan-500/20 text-cyan-300' },
                            { name: 'Electron 40', color: 'bg-violet-500/20 text-violet-300' },
                            { name: 'Vite 7', color: 'bg-amber-500/20 text-amber-300' },
                            { name: 'tRPC 11', color: 'bg-emerald-500/20 text-emerald-300' },
                        ].map((tech) => (
                            <span
                                key={tech.name}
                                className={`rounded-full px-4 py-2 text-sm font-medium ${tech.color} backdrop-blur-sm`}>
                                {tech.name}
                            </span>
                        ))}
                    </div>
                </header>

                {/* Core Stack */}
                <section className='animate-slide-up mb-32 delay-400'>
                    <div className='mb-10 flex items-center gap-4'>
                        <div className='from-electric-500 to-neon-500 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br'>
                            <VscExtensions className='h-6 w-6 text-white' />
                        </div>
                        <div>
                            <h2 className='text-3xl font-bold text-white'>Core Stack</h2>
                            <p className='text-white/40'>Battle-tested foundations</p>
                        </div>
                    </div>

                    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {coreStack.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.name}
                                    className='glass-card glass-card-hover group rounded-2xl p-6'
                                    style={{ animationDelay: `${String(400 + i * 80)}ms` }}>
                                    <div
                                        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} opacity-80 transition-all group-hover:scale-110 group-hover:opacity-100`}>
                                        <Icon className='h-6 w-6 text-white' />
                                    </div>
                                    <h3 className='mb-2 text-lg font-semibold text-white'>{item.name}</h3>
                                    <p className='text-sm leading-relaxed text-white/40'>{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Key Files */}
                <section className='animate-slide-up mb-32 delay-500'>
                    <div className='mb-10 flex items-center gap-4'>
                        <div className='from-mint-500 to-electric-500 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br'>
                            <VscCode className='h-6 w-6 text-white' />
                        </div>
                        <div>
                            <h2 className='text-3xl font-bold text-white'>Key Files</h2>
                            <p className='text-white/40'>Know where to find what</p>
                        </div>
                    </div>

                    <div className='glass-card overflow-hidden rounded-2xl'>
                        {keyFiles.map((file, i) => (
                            <div
                                key={file.path}
                                className={`group flex items-center justify-between px-8 py-5 transition-colors hover:bg-white/5 ${i !== keyFiles.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <code className={`font-mono text-sm ${file.color}`}>{file.path}</code>
                                <span className='text-sm text-white/30'>{file.desc}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* State Management - Zustand + Mutative */}
                <section className='animate-slide-up mb-32 delay-600'>
                    <div className='mb-10 flex items-center gap-4'>
                        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500'>
                            <VscFlame className='h-6 w-6 text-white' />
                        </div>
                        <div>
                            <h2 className='text-3xl font-bold text-white'>State Made Simple</h2>
                            <p className='text-white/40'>Zustand + Mutative in action</p>
                        </div>
                    </div>

                    <div className='glass-card overflow-hidden rounded-2xl'>
                        <div className='flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4'>
                            <div className='flex gap-2'>
                                <div className='bg-coral-500/80 h-3 w-3 rounded-full' />
                                <div className='h-3 w-3 rounded-full bg-amber-400/80' />
                                <div className='bg-mint-500/80 h-3 w-3 rounded-full' />
                            </div>
                            <span className='font-mono text-xs text-white/30'>store.ts</span>
                        </div>
                        <pre className='overflow-x-auto p-6 font-mono text-sm leading-relaxed'>
                            <code className='text-white/70'>
                                {codeExample.split('\n').map((line, i) => (
                                    <div key={i} className='flex'>
                                        <span className='mr-6 w-6 text-right text-white/20 select-none'>{i + 1}</span>
                                        <span>{line}</span>
                                    </div>
                                ))}
                            </code>
                        </pre>
                    </div>
                </section>

                {/* Getting Started */}
                <section className='animate-slide-up mb-32 delay-700'>
                    <div className='mb-10 flex items-center gap-4'>
                        <div className='from-coral-500 to-neon-500 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br'>
                            <VscRocket className='h-6 w-6 text-white' />
                        </div>
                        <div>
                            <h2 className='text-3xl font-bold text-white'>Get Started</h2>
                            <p className='text-white/40'>Up and running in seconds</p>
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {[
                            { step: '01', cmd: 'pnpm install', desc: 'Install dependencies' },
                            { step: '02', cmd: 'pnpm dev', desc: 'Start dev server' },
                            { step: '03', cmd: 'pnpm build:win', desc: 'Build for Windows' },
                        ].map((item) => (
                            <div key={item.step} className='glass-card rounded-2xl p-6'>
                                <span className='text-gradient-electric mb-4 block font-mono text-4xl font-bold opacity-50'>
                                    {item.step}
                                </span>
                                <code className='bg-obsidian-800 text-electric-400 mb-3 inline-block rounded-lg px-4 py-2 font-mono text-sm'>
                                    {item.cmd}
                                </code>
                                <p className='text-white/40'>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Convex Recommendation */}
                <section className='animate-slide-up mb-32 delay-800'>
                    <div className='glass-card group relative overflow-hidden rounded-3xl border-2 border-amber-500/20 p-10'>
                        <div className='absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5' />
                        <div className='absolute -top-32 -right-32 h-64 w-64 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/10 blur-3xl' />

                        <div className='relative flex flex-col items-center text-center lg:flex-row lg:text-left'>
                            <div className='mb-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 lg:mr-8 lg:mb-0'>
                                <VscDatabase className='h-10 w-10 text-white' />
                            </div>

                            <div className='flex-1'>
                                <div className='mb-2 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase'>
                                    Recommended
                                </div>
                                <h3 className='mb-3 text-2xl font-bold text-white'>Convex for Backend</h3>
                                <p className='mb-6 max-w-2xl leading-relaxed text-white/50'>
                                    The reactive backend platform with real-time sync, end-to-end type safety, and zero
                                    configuration. Perfect for Electron apps that need a serverless backend.
                                </p>
                                <a
                                    href='https://convex.dev/'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25'>
                                    Learn More
                                    <span className='transition-transform group-hover:translate-x-1'>→</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Other Recommendations - Single column list */}
                <section className='animate-slide-up mb-24 delay-800'>
                    <div className='mb-10 flex items-center gap-4'>
                        <div className='from-neon-500 to-coral-500 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br'>
                            <VscPackage className='h-6 w-6 text-white' />
                        </div>
                        <div>
                            <h2 className='text-3xl font-bold text-white'>Extend Your Stack</h2>
                            <p className='text-white/40'>Popular additions to consider</p>
                        </div>
                    </div>

                    <div className='glass-card overflow-hidden rounded-2xl'>
                        {[
                            {
                                name: 'Radix UI',
                                url: 'https://radix-ui.com/',
                                desc: 'Unstyled, accessible component primitives',
                                tag: 'UI',
                            },
                            {
                                name: 'Base UI',
                                url: 'https://base-ui.com/',
                                desc: 'Unstyled components from MUI team',
                                tag: 'UI',
                            },
                            {
                                name: 'shadcn/ui',
                                url: 'https://ui.shadcn.com/',
                                desc: 'Beautiful components on Radix + Tailwind',
                                tag: 'UI',
                            },
                            {
                                name: 'Drizzle ORM',
                                url: 'https://orm.drizzle.team/',
                                desc: 'TypeScript-first SQL ORM',
                                tag: 'Database',
                            },
                        ].map((pkg, i, arr) => (
                            <a
                                key={pkg.name}
                                href={pkg.url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className={`group flex items-center justify-between px-8 py-5 transition-colors hover:bg-white/5 ${i !== arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <div className='flex items-center gap-4'>
                                    <span className='rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/50'>
                                        {pkg.tag}
                                    </span>
                                    <div>
                                        <span className='group-hover:text-electric-400 font-semibold text-white'>
                                            {pkg.name}
                                        </span>
                                        <p className='text-sm text-white/40'>{pkg.desc}</p>
                                    </div>
                                </div>
                                <span className='text-white/30 transition-transform group-hover:translate-x-1'>→</span>
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
