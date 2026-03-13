import { ModelPicker } from '@/web/components/modelSelection/modelPicker';
import type { ModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';
import { Button } from '@/web/components/ui/button';

import type { RuntimeProviderId, TopLevelTab } from '@/shared/contracts';

interface WorkspaceThreadCreationSurfaceProps {
    workspaceRoots: Array<{
        fingerprint: string;
        label: string;
    }>;
    workspaceFingerprint: string | undefined;
    topLevelTab: TopLevelTab;
    title: string;
    providerId: RuntimeProviderId | undefined;
    modelId: string;
    modelOptions: ModelPickerOption[];
    isCreatingThread: boolean;
    onWorkspaceChange: (workspaceFingerprint: string | undefined) => void;
    onTopLevelTabChange: (topLevelTab: TopLevelTab) => void;
    onProviderChange: (providerId: RuntimeProviderId | undefined) => void;
    onModelChange: (modelId: string) => void;
    onTitleChange: (title: string) => void;
    onCreateThread: () => void;
    onCancel: () => void;
    onNavigateToWorkspaces: () => void;
}

function topLevelTabLabel(topLevelTab: TopLevelTab): string {
    if (topLevelTab === 'chat') {
        return 'Chat';
    }
    if (topLevelTab === 'agent') {
        return 'Agent';
    }
    return 'Orchestrator';
}

export function WorkspaceThreadCreationSurface({
    workspaceRoots,
    workspaceFingerprint,
    topLevelTab,
    title,
    providerId,
    modelId,
    modelOptions,
    isCreatingThread,
    onWorkspaceChange,
    onTopLevelTabChange,
    onProviderChange,
    onModelChange,
    onTitleChange,
    onCreateThread,
    onCancel,
    onNavigateToWorkspaces,
}: WorkspaceThreadCreationSurfaceProps) {
    const providerOptions = [
        ...new Map(
            modelOptions
                .filter((option) => option.providerId)
                .map((option) => [
                    option.providerId as RuntimeProviderId,
                    {
                        id: option.providerId as RuntimeProviderId,
                        label: option.providerLabel ?? option.providerId ?? 'Provider',
                    },
                ])
        ).values(),
    ];
    const selectedProviderId = providerId ?? providerOptions[0]?.id;
    const visibleModelOptions = selectedProviderId
        ? modelOptions.filter((option) => option.providerId === selectedProviderId)
        : modelOptions;
    const selectedModelId =
        modelId && visibleModelOptions.some((option) => option.id === modelId)
            ? modelId
            : visibleModelOptions[0]?.id ?? '';
    const selectedModelOption = visibleModelOptions.find((option) => option.id === selectedModelId);
    const hasWorkspaceOptions = workspaceRoots.length > 0;
    const createBlocked = !workspaceFingerprint || !selectedProviderId || selectedModelId.length === 0;

    return (
        <div className='space-y-4'>
            <div className='space-y-1'>
                <h3 className='text-lg font-semibold'>New thread</h3>
                <p className='text-muted-foreground text-sm'>
                    Create the thread inside a workspace first, then keep sessions and runs attached to it.
                </p>
            </div>

            <div className='grid gap-4 xl:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]'>
                <div className='space-y-2'>
                    <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                        Workspace
                    </label>
                    <select
                        aria-label='Thread workspace'
                        className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                        value={workspaceFingerprint ?? ''}
                        onChange={(event) => {
                            onWorkspaceChange(event.target.value || undefined);
                        }}>
                        {hasWorkspaceOptions ? null : <option value=''>No workspace registered yet</option>}
                        {workspaceRoots.map((workspaceRoot) => (
                            <option key={workspaceRoot.fingerprint} value={workspaceRoot.fingerprint}>
                                {workspaceRoot.label}
                            </option>
                        ))}
                    </select>
                    {!hasWorkspaceOptions ? (
                        <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/40 px-3 py-3'>
                            <p className='text-muted-foreground text-xs leading-5'>
                                Register a workspace first. Threads, branches, and runs stay anchored there.
                            </p>
                            <Button type='button' size='sm' onClick={onNavigateToWorkspaces}>
                                Add workspace
                            </Button>
                        </div>
                    ) : null}
                </div>

                <div className='grid gap-4 md:grid-cols-[minmax(0,0.32fr)_minmax(0,0.28fr)_minmax(0,0.4fr)]'>
                    <div className='space-y-2'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Mode
                        </label>
                        <select
                            aria-label='Thread mode'
                            className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                            value={topLevelTab}
                            onChange={(event) => {
                                const nextTab = event.target.value;
                                if (nextTab === 'chat' || nextTab === 'agent' || nextTab === 'orchestrator') {
                                    onTopLevelTabChange(nextTab);
                                }
                            }}>
                            <option value='chat'>{topLevelTabLabel('chat')}</option>
                            <option value='agent'>{topLevelTabLabel('agent')}</option>
                            <option value='orchestrator'>{topLevelTabLabel('orchestrator')}</option>
                        </select>
                    </div>

                    <div className='space-y-2'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Provider
                        </label>
                        <select
                            aria-label='Thread provider'
                            className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                            value={selectedProviderId ?? ''}
                            onChange={(event) => {
                                const nextProviderId = providerOptions.find(
                                    (option) => option.id === event.target.value
                                )?.id;
                                onProviderChange(nextProviderId);
                            }}>
                            {providerOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='space-y-2'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Model
                        </label>
                        <ModelPicker
                            providerId={selectedProviderId}
                            selectedModelId={selectedModelId}
                            models={visibleModelOptions}
                            ariaLabel='Thread model'
                            placeholder='Select a model'
                            onSelectModel={onModelChange}
                            onSelectOption={(option) => {
                                if (option.providerId && option.providerId !== selectedProviderId) {
                                    onProviderChange(option.providerId as RuntimeProviderId);
                                }
                                onModelChange(option.id);
                            }}
                        />
                        {selectedModelOption?.compatibilityReason ? (
                            <p className='text-muted-foreground text-xs'>{selectedModelOption.compatibilityReason}</p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className='space-y-2'>
                <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                    Title
                </label>
                <input
                    type='text'
                    value={title}
                    onChange={(event) => {
                        onTitleChange(event.target.value);
                    }}
                    className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                    autoComplete='off'
                    placeholder='Optional thread title…'
                />
            </div>

            <div className='flex items-center justify-between gap-3 border-t border-border/70 pt-4'>
                <p className='text-muted-foreground text-xs'>Primary actions stay at the bottom of the section they submit.</p>
                <div className='flex gap-2'>
                    <Button type='button' variant='ghost' onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type='button' disabled={isCreatingThread || createBlocked} onClick={onCreateThread}>
                        {isCreatingThread ? 'Creating…' : 'Create thread'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
