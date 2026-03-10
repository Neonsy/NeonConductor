import { X } from 'lucide-react';
import { useRef, useState } from 'react';

import { ContextSettingsView } from '@/web/components/settings/contextSettingsView';
import { ProfileSettingsView } from '@/web/components/settings/profileSettingsView';
import { ProviderSettingsView } from '@/web/components/settings/providerSettingsView';
import { RegistrySettingsView } from '@/web/components/settings/registrySettingsView';
import { getNextSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from '@/web/components/settings/settingsSheetNavigation';
import { usePrivacyMode } from '@/web/lib/privacy/privacyContext';

interface SettingsSheetProps {
    open: boolean;
    profileId: string;
    onClose: () => void;
    onProfileActivated: (profileId: string) => void;
}

const SECTION_LABELS: Record<SettingsSection, string> = {
    providers: 'Providers',
    profiles: 'Profiles',
    context: 'Context',
    agents: 'Agents',
};

export function SettingsSheet({ open, profileId, onClose, onProfileActivated }: SettingsSheetProps) {
    const [activeSection, setActiveSection] = useState<SettingsSection>('providers');
    const sectionButtonRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>({
        providers: null,
        profiles: null,
        context: null,
        agents: null,
    });
    const privacyMode = usePrivacyMode();

    if (!open) {
        return null;
    }

    function moveToSection(section: SettingsSection) {
        setActiveSection(section);
        sectionButtonRefs.current[section]?.focus();
    }

    return (
        <>
            <div className='bg-background/70 fixed inset-0 z-40 backdrop-blur-sm' onClick={onClose} />
            <section
                aria-labelledby='settings-sheet-title'
                className='border-border bg-card text-card-foreground fixed inset-y-0 right-0 z-50 flex w-[min(1080px,95vw)] border-l shadow-2xl'>
                <aside className='border-border bg-background/55 flex w-56 flex-col gap-2 border-r p-3'>
                    <h2 id='settings-sheet-title' className='text-sm font-semibold tracking-[0.18em] uppercase'>
                        Settings
                    </h2>
                    <nav role='tablist' aria-orientation='vertical' aria-label='Settings sections' className='space-y-2'>
                        {SETTINGS_SECTIONS.map((section) => (
                            <button
                                key={section}
                                ref={(element) => {
                                    sectionButtonRefs.current[section] = element;
                                }}
                                type='button'
                                id={`settings-tab-${section}`}
                                role='tab'
                                aria-selected={activeSection === section}
                                aria-controls={`settings-panel-${section}`}
                                tabIndex={activeSection === section ? 0 : -1}
                                className={`focus-visible:ring-ring w-full rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 ${
                                    activeSection === section
                                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                        : 'border-border bg-background hover:bg-accent'
                                }`}
                                onKeyDown={(event) => {
                                    const nextSection = getNextSettingsSection({
                                        currentSection: section,
                                        key: event.key,
                                    });
                                    if (!nextSection) {
                                        return;
                                    }

                                    event.preventDefault();
                                    moveToSection(nextSection);
                                }}
                                onClick={() => {
                                    setActiveSection(section);
                                }}>
                                {SECTION_LABELS[section]}
                            </button>
                        ))}
                    </nav>
                </aside>

                <div className='flex min-w-0 flex-1 flex-col'>
                    <header className='border-border flex items-center justify-between border-b px-5 py-4'>
                        <div>
                            <h3 className='text-balance text-base font-semibold'>{SECTION_LABELS[activeSection]}</h3>
                            <p className='text-muted-foreground text-xs'>
                                Core runtime is provider-neutral. Kilo-only features stay gated until Kilo login.
                            </p>
                            {privacyMode.enabled ? (
                                <p className='text-primary mt-1 text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                    Privacy mode active
                                </p>
                            ) : null}
                        </div>
                        <button
                            type='button'
                            className='hover:bg-accent focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:ring-2'
                            onClick={onClose}
                            aria-label='Close settings'>
                            <X className='h-4 w-4' />
                        </button>
                    </header>

                    <div
                        id={`settings-panel-${activeSection}`}
                        role='tabpanel'
                        aria-labelledby={`settings-tab-${activeSection}`}
                        className='min-h-0 flex-1 overflow-auto'>
                        {activeSection === 'providers' ? <ProviderSettingsView profileId={profileId} /> : null}
                        {activeSection === 'profiles' ? (
                            <ProfileSettingsView activeProfileId={profileId} onProfileActivated={onProfileActivated} />
                        ) : null}
                        {activeSection === 'context' ? <ContextSettingsView activeProfileId={profileId} /> : null}
                        {activeSection === 'agents' ? <RegistrySettingsView profileId={profileId} /> : null}
                    </div>
                </div>
            </section>
        </>
    );
}
