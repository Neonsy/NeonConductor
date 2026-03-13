import { useId, useRef } from 'react';

import { useConversationSidebarState } from '@/web/components/conversation/hooks/useConversationSidebarState';
import { ModelPicker } from '@/web/components/modelSelection/modelPicker';
import type { ModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';
import { Button } from '@/web/components/ui/button';
import { DialogSurface } from '@/web/components/ui/dialogSurface';

import type { TopLevelTab, RuntimeProviderId } from '@/shared/contracts';

interface SidebarThreadComposerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    topLevelTab: TopLevelTab;
    workspaceRoots: Array<{
        fingerprint: string;
        label: string;
        absolutePath: string;
    }>;
    preferredWorkspaceFingerprint?: string;
    preferredProviderId?: RuntimeProviderId;
    preferredModelId?: string;
    modelOptions: ModelPickerOption[];
    isCreatingThread: boolean;
    onCreateThread: (input: {
        topLevelTab: TopLevelTab;
        scope: 'detached' | 'workspace';
        workspacePath?: string;
        title: string;
        providerId?: RuntimeProviderId;
        modelId?: string;
    }) => Promise<void>;
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

export function SidebarThreadComposer({
    open,
    onOpenChange,
    topLevelTab,
    workspaceRoots,
    preferredWorkspaceFingerprint,
    preferredProviderId,
    preferredModelId,
    modelOptions,
    isCreatingThread,
    onCreateThread,
    onNavigateToWorkspaces,
}: SidebarThreadComposerProps) {
    const {
        newThreadTitle,
        setNewThreadTitle,
        newThreadTopLevelTab,
        setNewThreadTopLevelTab,
        newThreadScope,
        setNewThreadScope,
        newThreadWorkspaceFingerprint,
        setNewThreadWorkspaceFingerprint,
        newThreadProviderId,
        setNewThreadProviderId,
        newThreadModelId,
        setNewThreadModelId,
        createThread,
    } = useConversationSidebarState({
        topLevelTab,
        isCreatingThread,
        workspaceRoots: workspaceRoots.map((workspaceRoot) => ({
            fingerprint: workspaceRoot.fingerprint,
            absolutePath: workspaceRoot.absolutePath,
        })),
        ...(preferredWorkspaceFingerprint ? { preferredWorkspaceFingerprint } : {}),
        ...(preferredProviderId ? { preferredProviderId } : {}),
        ...(preferredModelId ? { preferredModelId } : {}),
        onCreateThread,
    });
    const dialogTitleId = useId();
    const dialogDescriptionId = useId();
    const newThreadTitleInputRef = useRef<HTMLInputElement>(null);
    const requiresWorkspace = newThreadTopLevelTab !== 'chat';
    const workspaceSelectionValue = newThreadScope === 'workspace' ? newThreadWorkspaceFingerprint ?? '' : 'detached';
    const hasWorkspaceOptions = workspaceRoots.length > 0;
    const createBlockedByWorkspace = requiresWorkspace && !newThreadWorkspaceFingerprint;
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
    const selectedProviderId = newThreadProviderId ?? preferredProviderId;
    const visibleModelOptions = selectedProviderId
        ? modelOptions.filter((option) => option.providerId === selectedProviderId)
        : modelOptions;
    const selectedModelId =
        newThreadModelId && visibleModelOptions.some((option) => option.id === newThreadModelId)
            ? newThreadModelId
            : visibleModelOptions[0]?.id ?? '';
    const selectedModelOption = visibleModelOptions.find((option) => option.id === selectedModelId);
    const selectedModelReason = selectedModelOption?.compatibilityReason;
    const createBlockedByModel = selectedModelOption?.compatibilityState === 'incompatible';

    return (
        <DialogSurface
            open={open}
            titleId={dialogTitleId}
            descriptionId={dialogDescriptionId}
            initialFocusRef={newThreadTitleInputRef}
            onClose={() => {
                onOpenChange(false);
            }}>
            <div className='border-border bg-background w-[min(92vw,34rem)] rounded-[28px] border p-5 shadow-xl'>
                <div className='space-y-1'>
                    <h2 id={dialogTitleId} className='text-lg font-semibold'>
                        New thread
                    </h2>
                    <p id={dialogDescriptionId} className='text-muted-foreground text-sm'>
                        Threads live inside a workspace. Pick the workspace, mode, and model before you start.
                    </p>
                </div>

                <div className='mt-4 space-y-3'>
                    <div className='space-y-1.5'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Workspace
                        </label>
                        <select
                            aria-label='Thread workspace context'
                            className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                            value={workspaceSelectionValue}
                            onChange={(event) => {
                                if (event.target.value === 'detached') {
                                    setNewThreadScope('detached');
                                    return;
                                }

                                setNewThreadScope('workspace');
                                setNewThreadWorkspaceFingerprint(event.target.value || undefined);
                            }}>
                            {!requiresWorkspace ? <option value='detached'>Playground thread</option> : null}
                            {hasWorkspaceOptions ? null : <option value=''>No workspace registered yet</option>}
                            {workspaceRoots.map((workspaceRoot) => (
                                <option key={workspaceRoot.fingerprint} value={workspaceRoot.fingerprint}>
                                    {workspaceRoot.label}
                                </option>
                            ))}
                        </select>
                        {!hasWorkspaceOptions ? (
                            <div className='flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/40 px-3 py-3'>
                                <p className='text-muted-foreground text-xs leading-5'>
                                    Register a workspace first. Agent and orchestrator threads stay workspace-scoped.
                                </p>
                                <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => {
                                        onOpenChange(false);
                                        onNavigateToWorkspaces();
                                    }}>
                                    Add workspace
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Mode
                        </label>
                        <select
                            aria-label='Thread mode'
                            className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                            value={newThreadTopLevelTab}
                            onChange={(event) => {
                                const nextTab = event.target.value;
                                if (nextTab === 'chat' || nextTab === 'agent' || nextTab === 'orchestrator') {
                                    setNewThreadTopLevelTab(nextTab);
                                }
                            }}>
                            <option value='chat'>{topLevelTabLabel('chat')}</option>
                            <option value='agent'>{topLevelTabLabel('agent')}</option>
                            <option value='orchestrator'>{topLevelTabLabel('orchestrator')}</option>
                        </select>
                    </div>

                    <div className='grid gap-3 md:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]'>
                        <div className='space-y-1.5'>
                            <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                Provider
                            </label>
                            <select
                                aria-label='Thread provider'
                                className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                                value={selectedProviderId ?? ''}
                                onChange={(event) => {
                                    const nextProviderId = providerOptions.find(
                                        (provider) => provider.id === event.target.value
                                    )?.id;
                                    setNewThreadProviderId(nextProviderId);
                                    const nextModelId = modelOptions.find(
                                        (option) => option.providerId === nextProviderId
                                    )?.id;
                                    setNewThreadModelId(nextModelId);
                                }}>
                                {providerOptions.map((provider) => (
                                    <option key={provider.id} value={provider.id}>
                                        {provider.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className='space-y-1.5'>
                            <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                Model
                            </label>
                            <ModelPicker
                                providerId={selectedProviderId}
                                selectedModelId={selectedModelId}
                                models={visibleModelOptions}
                                ariaLabel='Thread model'
                                placeholder='Select a model'
                                onSelectModel={(modelId) => {
                                    setNewThreadModelId(modelId);
                                }}
                                onSelectOption={(option) => {
                                    if (option.providerId && option.providerId !== selectedProviderId) {
                                        setNewThreadProviderId(option.providerId as RuntimeProviderId);
                                    }
                                    setNewThreadModelId(option.id);
                                }}
                            />
                        </div>
                    </div>
                    {selectedModelReason ? <p className='text-xs text-muted-foreground'>{selectedModelReason}</p> : null}

                    <div className='space-y-1.5'>
                        <label className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            Title
                        </label>
                        <input
                            ref={newThreadTitleInputRef}
                            aria-label='Thread title'
                            name='newThreadTitle'
                            value={newThreadTitle}
                            onChange={(event) => {
                                setNewThreadTitle(event.target.value);
                            }}
                            className='border-border bg-card h-10 w-full rounded-2xl border px-3 text-sm'
                            autoComplete='off'
                            placeholder='Optional thread title…'
                        />
                    </div>
                </div>

                <div className='mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4'>
                    <p className='text-muted-foreground text-xs'>Primary actions stay at the bottom of the section they submit.</p>
                    <div className='flex gap-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => {
                                onOpenChange(false);
                            }}>
                            Cancel
                        </Button>
                        <Button
                            type='button'
                            disabled={isCreatingThread || createBlockedByWorkspace || createBlockedByModel}
                            onClick={() => {
                                void createThread().then(() => {
                                    onOpenChange(false);
                                });
                            }}>
                            Create thread
                        </Button>
                    </div>
                </div>
            </div>
        </DialogSurface>
    );
}
