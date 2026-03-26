import { ArrowLeft } from 'lucide-react';
import { startTransition } from 'react';

import {
    getGroupedSettingsPrimarySections,
    SettingsSectionContent,
} from '@/web/components/settings/settingsSectionContent';
import {
    getDefaultSettingsSelection,
    type SettingsPrimarySectionId,
    type SettingsSelection,
} from '@/web/components/settings/settingsNavigation';
import { usePrivacyMode } from '@/web/lib/privacy/privacyContext';

interface SettingsWorkspaceProps {
    profileId: string;
    selection: SettingsSelection;
    onSelectionChange: (selection: SettingsSelection) => void;
    onProfileActivated: (profileId: string) => void;
    onReturnToSessions: () => void;
    onPreviewReturnToSessions?: () => void;
    currentWorkspaceFingerprint?: string;
    selectedWorkspaceLabel?: string;
}

function PrimaryRailButton({
    section,
    selected,
    onSelect,
}: {
    section: ReturnType<typeof getGroupedSettingsPrimarySections>['kiloSections'][number];
    selected: boolean;
    onSelect: (sectionId: SettingsPrimarySectionId) => void;
}) {
    return (
        <button
            type='button'
            className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                selected
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border/80 bg-card/70 hover:bg-accent'
            }`}
            onClick={() => {
                onSelect(section.id);
            }}>
            <div className='space-y-1'>
                <p className='min-w-0 text-sm font-medium break-words'>{section.label}</p>
                <p className='text-muted-foreground text-[11px] leading-5'>{section.description}</p>
            </div>
        </button>
    );
}

export function SettingsWorkspace({
    profileId,
    selection,
    onSelectionChange,
    onProfileActivated,
    onReturnToSessions,
    onPreviewReturnToSessions,
    currentWorkspaceFingerprint,
    selectedWorkspaceLabel,
}: SettingsWorkspaceProps) {
    const privacyMode = usePrivacyMode();
    const { kiloSections, generalSections } = getGroupedSettingsPrimarySections();

    function selectPrimarySection(section: SettingsPrimarySectionId) {
        startTransition(() => {
            onSelectionChange(selection.section === section ? selection : getDefaultSettingsSelection(section));
        });
    }

    return (
        <section className='flex h-full min-h-0 min-w-0 flex-1 overflow-hidden'>
            <aside className='border-border/80 bg-background/70 flex min-h-0 w-[272px] shrink-0 flex-col gap-4 overflow-y-auto border-r p-4'>
                <div className='space-y-3'>
                    <button
                        type='button'
                        className='border-border bg-card hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors'
                        aria-label='Back to sessions'
                        title='Back to sessions'
                        onPointerEnter={onPreviewReturnToSessions}
                        onFocus={onPreviewReturnToSessions}
                        onClick={onReturnToSessions}>
                        <ArrowLeft className='h-4 w-4' />
                    </button>

                    <div className='space-y-1'>
                        <h2 className='text-sm font-semibold tracking-[0.18em] uppercase'>Settings</h2>
                        <p className='text-muted-foreground text-xs'>
                            Kilo is the default setup path. The other sections cover shared instructions, providers,
                            profiles, workspace limits, rules, skills, and app tools.
                        </p>
                        {privacyMode.enabled ? (
                            <p className='text-primary text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                Privacy mode active
                            </p>
                        ) : null}
                    </div>
                </div>

                <nav aria-label='Settings sections' className='min-h-0 min-w-0 space-y-4'>
                    <div className='space-y-1.5'>
                        {kiloSections.map((section) => (
                            <PrimaryRailButton
                                key={section.id}
                                section={section}
                                selected={selection.section === section.id}
                                onSelect={selectPrimarySection}
                            />
                        ))}
                    </div>

                    <div className='border-border/80 border-t pt-4'>
                        <div className='space-y-1.5'>
                            {generalSections.map((section) => (
                                <PrimaryRailButton
                                    key={section.id}
                                    section={section}
                                    selected={selection.section === section.id}
                                    onSelect={selectPrimarySection}
                                />
                            ))}
                        </div>
                    </div>
                </nav>
            </aside>

            <div className='bg-background/20 h-full min-h-0 min-w-0 flex-1 overflow-hidden'>
                <SettingsSectionContent
                    profileId={profileId}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    onProfileActivated={onProfileActivated}
                    {...(currentWorkspaceFingerprint ? { currentWorkspaceFingerprint } : {})}
                    {...(selectedWorkspaceLabel ? { selectedWorkspaceLabel } : {})}
                />
            </div>
        </section>
    );
}
