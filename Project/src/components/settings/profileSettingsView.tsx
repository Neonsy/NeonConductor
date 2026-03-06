import { useProfileSettingsController } from '@/web/components/settings/profileSettings/useProfileSettingsController';
import { Button } from '@/web/components/ui/button';
import { ConfirmDialog } from '@/web/components/ui/confirmDialog';

interface ProfileSettingsViewProps {
    activeProfileId: string;
    onProfileActivated: (profileId: string) => void;
}

export function ProfileSettingsView({ activeProfileId, onProfileActivated }: ProfileSettingsViewProps) {
    const controller = useProfileSettingsController({
        activeProfileId,
        onProfileActivated,
    });

    return (
        <section className='grid min-h-full grid-cols-[280px_1fr]'>
            <aside className='border-border bg-background/40 min-h-0 overflow-y-auto border-r p-3'>
                <p className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>Profiles</p>
                <div className='space-y-2'>
                    {controller.profiles.map((profile) => (
                        <button
                            key={profile.id}
                            type='button'
                            className={`w-full rounded-md border px-2 py-2 text-left ${
                                profile.id === controller.selectedProfileId
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border bg-card hover:bg-accent'
                            }`}
                            onClick={() => {
                                controller.setSelectedProfileId(profile.id);
                            }}>
                            <p className='text-sm font-medium'>
                                {profile.name}{' '}
                                {profile.id === activeProfileId ? (
                                    <span className='text-primary text-xs'>(active)</span>
                                ) : null}
                            </p>
                            <p className='text-muted-foreground truncate text-[11px]'>{profile.id}</p>
                        </button>
                    ))}
                </div>
            </aside>

            <div className='min-h-0 overflow-y-auto p-4'>
                <div className='space-y-5'>
                    <section className='space-y-2'>
                        <p className='text-sm font-semibold'>Create Profile</p>
                        <div className='grid grid-cols-[1fr_auto] gap-2'>
                            <input
                                type='text'
                                value={controller.newProfileName}
                                onChange={(event) => {
                                    controller.setNewProfileName(event.target.value);
                                }}
                                className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                                placeholder='New profile name (optional)'
                            />
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={controller.createMutation.isPending}
                                onClick={() => {
                                    void controller.createProfile();
                                }}>
                                Create
                            </Button>
                        </div>
                    </section>

                    {controller.selectedProfile ? (
                        <section className='space-y-3'>
                            <p className='text-sm font-semibold'>Selected Profile</p>
                            <div className='grid grid-cols-[1fr_auto_auto] gap-2'>
                                <input
                                    type='text'
                                    value={controller.renameValue}
                                    onChange={(event) => {
                                        controller.setRenameValue(event.target.value);
                                    }}
                                    className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                                    placeholder='Profile name'
                                />
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={
                                        controller.renameMutation.isPending ||
                                        controller.renameValue.trim().length === 0 ||
                                        controller.renameValue.trim() === controller.selectedProfile.name
                                    }
                                    onClick={() => {
                                        void controller.renameProfile();
                                    }}>
                                    Rename
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={controller.duplicateMutation.isPending}
                                    onClick={() => {
                                        void controller.duplicateProfile();
                                    }}>
                                    Duplicate
                                </Button>
                            </div>

                            <div className='flex flex-wrap items-center gap-2'>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={
                                        controller.setActiveMutation.isPending ||
                                        controller.selectedProfile.id === activeProfileId
                                    }
                                    onClick={() => {
                                        void controller.activateProfile();
                                    }}>
                                    {controller.selectedProfile.id === activeProfileId ? 'Active' : 'Set Active'}
                                </Button>

                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={controller.cannotDeleteLastProfile || controller.deleteMutation.isPending}
                                    onClick={() => {
                                        controller.setConfirmDeleteOpen(true);
                                    }}>
                                    Delete
                                </Button>
                                <span className='text-muted-foreground text-xs'>
                                    {controller.cannotDeleteLastProfile
                                        ? 'Cannot delete the last remaining profile.'
                                        : 'Deletion removes local profile-scoped data.'}
                                </span>
                            </div>

                            <div className='space-y-1 pt-2'>
                                <p className='text-sm font-semibold'>Conversation Edit Behavior</p>
                                <p className='text-muted-foreground text-xs'>
                                    Controls default behavior when editing earlier user messages.
                                </p>
                                <select
                                    className='border-border bg-background h-9 w-full max-w-sm rounded-md border px-2 text-sm'
                                    value={controller.editPreferenceQuery.data?.value ?? 'ask'}
                                    disabled={controller.setEditPreferenceMutation.isPending}
                                    onChange={(event) => {
                                        const nextValue = event.target.value;
                                        if (nextValue !== 'ask' && nextValue !== 'truncate' && nextValue !== 'branch') {
                                            return;
                                        }

                                        void controller.updateEditPreference(nextValue);
                                    }}>
                                    <option value='ask'>Ask every time</option>
                                    <option value='truncate'>Always truncate</option>
                                    <option value='branch'>Always branch</option>
                                </select>
                            </div>

                            <div className='space-y-1 pt-2'>
                                <p className='text-sm font-semibold'>Thread Title Generation</p>
                                <p className='text-muted-foreground text-xs'>
                                    Controls how new thread titles are generated from provider/model and prompt context.
                                </p>
                                <select
                                    className='border-border bg-background h-9 w-full max-w-sm rounded-md border px-2 text-sm'
                                    value={controller.threadTitlePreferenceQuery.data?.mode ?? 'template'}
                                    disabled={controller.setThreadTitlePreferenceMutation.isPending}
                                    onChange={(event) => {
                                        const nextMode = event.target.value;
                                        if (nextMode !== 'template' && nextMode !== 'ai_optional') {
                                            return;
                                        }

                                        void controller.updateThreadTitleMode(nextMode);
                                    }}>
                                    <option value='template'>Template only</option>
                                    <option value='ai_optional'>Template + optional AI refine</option>
                                </select>
                                <input
                                    type='text'
                                    value={controller.threadTitleAiModelInput}
                                    onChange={(event) => {
                                        controller.setThreadTitleAiModelInput(event.target.value);
                                    }}
                                    className='border-border bg-background h-9 w-full max-w-sm rounded-md border px-2 text-sm'
                                    placeholder='Title AI model id (e.g. openai/gpt-5-mini)'
                                />
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={
                                        controller.setThreadTitlePreferenceMutation.isPending ||
                                        controller.threadTitleAiModelInput.trim().length === 0
                                    }
                                    onClick={() => {
                                        void controller.saveThreadTitleAiModel();
                                    }}>
                                    Save AI Model
                                </Button>
                            </div>
                        </section>
                    ) : null}

                    {controller.statusMessage ? <p className='text-primary text-xs'>{controller.statusMessage}</p> : null}
                </div>
            </div>

            <ConfirmDialog
                open={controller.confirmDeleteOpen}
                title='Delete Profile'
                message='Delete this profile and all local profile-scoped runtime data? This cannot be undone.'
                confirmLabel='Delete profile'
                destructive
                busy={controller.deleteMutation.isPending}
                onCancel={() => {
                    controller.setConfirmDeleteOpen(false);
                }}
                onConfirm={() => {
                    void controller.deleteProfile();
                }}
            />
        </section>
    );
}
