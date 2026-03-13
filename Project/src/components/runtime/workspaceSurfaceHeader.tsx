import PrivacyModeToggle from '@/web/components/window/privacyModeToggle';
import { WorkspaceSurfaceUtilityMenu } from '@/web/components/runtime/workspaceSurfaceUtilityMenu';

import type { WorkspaceAppSection } from '@/web/components/runtime/workspaceSurfaceModel';

interface WorkspaceSurfaceHeaderProps {
    appSection: WorkspaceAppSection;
    primarySection: Exclude<WorkspaceAppSection, 'settings'>;
    profiles: Array<{ id: string; name: string }>;
    resolvedProfileId: string | undefined;
    isSwitchingProfile: boolean;
    workspaceOptions: Array<{ fingerprint: string; label: string }>;
    selectedWorkspaceFingerprint: string | undefined;
    onProfileChange: (profileId: string) => void;
    onWorkspaceChange: (workspaceFingerprint: string | undefined) => void;
    onPrimarySectionChange: (section: Exclude<WorkspaceAppSection, 'settings'>) => void;
    onOpenSettings: () => void;
    onReturnToPrimarySection: () => void;
    onOpenCommandPalette: () => void;
}

export function WorkspaceSurfaceHeader({
    appSection,
    primarySection,
    profiles,
    resolvedProfileId,
    isSwitchingProfile,
    workspaceOptions,
    selectedWorkspaceFingerprint,
    onProfileChange,
    onWorkspaceChange,
    onPrimarySectionChange,
    onOpenSettings,
    onReturnToPrimarySection,
    onOpenCommandPalette,
}: WorkspaceSurfaceHeaderProps) {
    return (
        <header className='border-border/80 bg-background/88 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-sm'>
            <div className='flex min-w-0 items-center gap-3'>
                <div className='min-w-0'>
                    <p className='text-[11px] font-semibold tracking-[0.14em] uppercase'>NeonConductor</p>
                    <p className='text-muted-foreground text-xs'>Workspace-first command surface</p>
                </div>

                <div
                    role='tablist'
                    aria-label='Primary work areas'
                    className='border-border bg-card/60 inline-flex shrink-0 rounded-full border p-1'>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={primarySection === 'sessions'}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            primarySection === 'sessions'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => {
                            onPrimarySectionChange('sessions');
                        }}>
                        Sessions
                    </button>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={primarySection === 'workspaces'}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            primarySection === 'workspaces'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => {
                            onPrimarySectionChange('workspaces');
                        }}>
                        Workspaces
                    </button>
                </div>
            </div>

            <div className='flex min-w-0 flex-wrap items-center justify-end gap-2'>
                <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                    <span className='sr-only'>Workspace</span>
                    <select
                        className='border-border bg-card h-9 min-w-[200px] rounded-full border px-3 text-sm'
                        value={selectedWorkspaceFingerprint ?? ''}
                        onChange={(event) => {
                            const nextValue = event.target.value.trim();
                            onWorkspaceChange(nextValue.length > 0 ? nextValue : undefined);
                        }}>
                        <option value=''>All workspaces</option>
                        {workspaceOptions.map((workspace) => (
                            <option key={workspace.fingerprint} value={workspace.fingerprint}>
                                {workspace.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                    <span className='sr-only'>Profile</span>
                    <select
                        className='border-border bg-card h-9 min-w-[200px] rounded-full border px-3 text-sm'
                        value={resolvedProfileId ?? ''}
                        disabled={!resolvedProfileId || isSwitchingProfile}
                        onChange={(event) => {
                            onProfileChange(event.target.value.trim());
                        }}>
                        {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.name}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    type='button'
                    className='border-border bg-card hover:bg-accent rounded-full border px-3 py-1.5 text-sm font-medium'
                    onClick={onOpenCommandPalette}>
                    Search · Cmd/Ctrl+K
                </button>

                <WorkspaceSurfaceUtilityMenu
                    appSection={appSection}
                    primarySection={primarySection}
                    onOpenSettings={onOpenSettings}
                    onReturnToPrimarySection={onReturnToPrimarySection}
                    onOpenCommandPalette={onOpenCommandPalette}
                />

                <PrivacyModeToggle />
            </div>
        </header>
    );
}
