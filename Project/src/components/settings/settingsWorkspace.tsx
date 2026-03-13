import { ArrowLeft } from 'lucide-react';
import { startTransition, useState } from 'react';

import { AppSettingsView } from '@/web/components/settings/appSettings/view';
import { ContextSettingsView } from '@/web/components/settings/contextSettingsView';
import { ProfileSettingsView } from '@/web/components/settings/profileSettingsView';
import { ProvidersWorkspaceView } from '@/web/components/settings/providersWorkspace/view';
import { RegistrySettingsView } from '@/web/components/settings/registrySettingsView';
import { usePrivacyMode } from '@/web/lib/privacy/privacyContext';

type SettingsWorkspaceSection = 'providers' | 'profiles' | 'context' | 'skills' | 'app';

const SETTINGS_SECTIONS: ReadonlyArray<SettingsWorkspaceSection> = ['providers', 'profiles', 'context', 'skills', 'app'];

const SECTION_LABELS: Record<SettingsWorkspaceSection, string> = {
    providers: 'Providers & Models',
    profiles: 'Profiles',
    context: 'Context & Limits',
    skills: 'Skills & Registry',
    app: 'App',
};

const SECTION_DESCRIPTIONS: Record<SettingsWorkspaceSection, string> = {
    providers: 'Kilo, direct providers, authentication, and default model selection.',
    profiles: 'Execution presets, profile names, and active profile switching.',
    context: 'Global defaults, profile overrides, and composer media limits.',
    skills: 'Registry health, refresh, and resolved skills, rules, and modes.',
    app: 'Privacy mode and destructive app-level maintenance actions.',
};

interface SettingsWorkspaceProps {
    profileId: string;
    onProfileActivated: (profileId: string) => void;
    onReturnToSessions: () => void;
}

export function SettingsWorkspace({ profileId, onProfileActivated, onReturnToSessions }: SettingsWorkspaceProps) {
    const [activeSection, setActiveSection] = useState<SettingsWorkspaceSection>('providers');
    const privacyMode = usePrivacyMode();

    return (
        <section className='flex h-full min-h-0 min-w-0 flex-1 overflow-hidden'>
            <aside className='border-border/80 bg-background/70 flex w-[272px] shrink-0 flex-col gap-3 border-r p-4'>
                <div className='space-y-1'>
                    <h2 className='text-sm font-semibold tracking-[0.18em] uppercase'>Settings</h2>
                    <p className='text-muted-foreground text-xs leading-5'>
                        Full-page settings, organized by what the app manages instead of where the old modal happened
                        to put things.
                    </p>
                </div>

                <nav aria-label='Settings sections' className='space-y-2'>
                    {SETTINGS_SECTIONS.map((section) => (
                        <button
                            key={section}
                            type='button'
                            className={`w-full rounded-[22px] border px-3 py-3 text-left transition-colors ${
                                activeSection === section
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border bg-card/80 hover:bg-accent'
                            }`}
                            onClick={() => {
                                startTransition(() => {
                                    setActiveSection(section);
                                });
                            }}>
                            <p className='text-sm font-medium'>{SECTION_LABELS[section]}</p>
                            <p className='text-muted-foreground mt-1 text-[11px] leading-4'>
                                {SECTION_DESCRIPTIONS[section]}
                            </p>
                        </button>
                    ))}
                </nav>
            </aside>

            <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
                <header className='border-border/80 bg-background/40 flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6'>
                    <div className='flex items-start gap-3'>
                        <button
                            type='button'
                            className='border-border bg-card hover:bg-accent inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors'
                            aria-label='Back to sessions'
                            title='Back to sessions'
                            onClick={onReturnToSessions}>
                            <ArrowLeft className='h-4 w-4' />
                        </button>
                        <div className='space-y-1'>
                            <p className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                Settings
                            </p>
                            <h3 className='text-lg font-semibold text-balance'>{SECTION_LABELS[activeSection]}</h3>
                            <p className='text-muted-foreground text-sm'>{SECTION_DESCRIPTIONS[activeSection]}</p>
                            {privacyMode.enabled ? (
                                <p className='text-primary text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                    Privacy mode active
                                </p>
                            ) : null}
                        </div>
                    </div>
                </header>

                <div className='bg-background/20 h-full min-h-0 min-w-0 flex-1 overflow-hidden'>
                    {activeSection === 'providers' ? <ProvidersWorkspaceView profileId={profileId} /> : null}
                    {activeSection === 'profiles' ? (
                        <ProfileSettingsView activeProfileId={profileId} onProfileActivated={onProfileActivated} />
                    ) : null}
                    {activeSection === 'context' ? <ContextSettingsView activeProfileId={profileId} /> : null}
                    {activeSection === 'skills' ? <RegistrySettingsView profileId={profileId} /> : null}
                    {activeSection === 'app' ? <AppSettingsView /> : null}
                </div>
            </div>
        </section>
    );
}
