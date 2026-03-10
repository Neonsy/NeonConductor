import type { TopLevelTab } from '@/shared/contracts';

const TAB_OPTIONS: Array<{ id: TopLevelTab; label: string }> = [
    { id: 'chat', label: 'Chat' },
    { id: 'agent', label: 'Agent' },
    { id: 'orchestrator', label: 'Orchestrator' },
];

interface WorkspaceSurfaceHeaderProps {
    profiles: Array<{ id: string; name: string }>;
    resolvedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
    modes: Array<{ id: string; modeKey: string; label: string }>;
    activeModeKey: string;
    isSwitchingProfile: boolean;
    onTopLevelTabChange: (topLevelTab: TopLevelTab) => void;
    onPreviewTopLevelTab?: (topLevelTab: TopLevelTab) => void;
    onProfileChange: (profileId: string) => void;
    onOpenSettings: () => void;
    onModeChange: (modeKey: string) => void;
}

export function WorkspaceSurfaceHeader({
    profiles,
    resolvedProfileId,
    topLevelTab,
    modes,
    activeModeKey,
    isSwitchingProfile,
    onTopLevelTabChange,
    onPreviewTopLevelTab,
    onProfileChange,
    onOpenSettings,
    onModeChange,
}: WorkspaceSurfaceHeaderProps) {
    return (
        <header className='border-border bg-card/35 flex items-center justify-between border-b px-3 py-2'>
            <div className='flex items-center gap-2'>
                {TAB_OPTIONS.map((tab) => (
                    <button
                        key={tab.id}
                        type='button'
                        className={`rounded-md border px-2.5 py-1 text-sm ${
                            tab.id === topLevelTab
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background hover:bg-accent'
                        }`}
                        onMouseEnter={() => {
                            onPreviewTopLevelTab?.(tab.id);
                        }}
                        onFocus={() => {
                            onPreviewTopLevelTab?.(tab.id);
                        }}
                        onClick={() => {
                            onTopLevelTabChange(tab.id);
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-xs font-medium'>Profile</span>
                <select
                    className='border-border bg-background h-8 min-w-[220px] rounded-md border px-2 text-sm'
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

                <button
                    type='button'
                    className='border-border bg-background hover:bg-accent rounded-md border px-2.5 py-1 text-sm'
                    onClick={onOpenSettings}>
                    Settings
                </button>
                <span className='text-muted-foreground text-xs font-medium'>Mode</span>
                <select
                    className='border-border bg-background h-8 min-w-[180px] rounded-md border px-2 text-sm'
                    value={activeModeKey}
                    disabled={!resolvedProfileId}
                    onChange={(event) => {
                        onModeChange(event.target.value.trim());
                    }}>
                    {modes.map((mode) => (
                        <option key={mode.id} value={mode.modeKey}>
                            {mode.label}
                        </option>
                    ))}
                </select>
            </div>
        </header>
    );
}

