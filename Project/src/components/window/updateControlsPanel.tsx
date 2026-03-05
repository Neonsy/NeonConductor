import { useState } from 'react';

import { Button } from '@/web/components/ui/button';
import { ConfirmDialog } from '@/web/components/ui/confirmDialog';
import { trpc } from '@/web/trpc/client';

type UpdateChannel = 'stable' | 'beta' | 'alpha';

interface UpdateControlsPanelProps {
    open: boolean;
    onClose: () => void;
}

const CHANNEL_OPTIONS: Array<{ id: UpdateChannel; label: string; description: string }> = [
    { id: 'stable', label: 'Stable', description: 'Most reliable release channel.' },
    { id: 'beta', label: 'Beta', description: 'Pre-release builds with newer features.' },
    { id: 'alpha', label: 'Alpha', description: 'Earliest builds with highest risk.' },
];

export function UpdateControlsPanel({ open, onClose }: UpdateControlsPanelProps) {
    const channelQuery = trpc.updates.getChannel.useQuery(undefined, { refetchOnWindowFocus: false });
    const checkMutation = trpc.updates.checkForUpdates.useMutation();
    const setChannelMutation = trpc.updates.setChannel.useMutation({
        onSuccess: () => {
            void channelQuery.refetch();
        },
    });
    const [pendingChannel, setPendingChannel] = useState<UpdateChannel | null>(null);

    const currentChannel = channelQuery.data?.channel ?? 'stable';

    const selectedMeta = CHANNEL_OPTIONS.find((option) => option.id === currentChannel);

    if (!open) {
        return null;
    }

    return (
        <>
            <div className='fixed inset-0 z-40' onClick={onClose} />
            <section className='border-border bg-card text-card-foreground absolute top-10 left-2 z-50 w-[320px] rounded-xl border p-3 shadow-xl'>
                <div className='mb-2'>
                    <p className='text-xs font-semibold tracking-[0.12em] uppercase'>Updates</p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                        Current: <span className='text-foreground font-medium'>{selectedMeta?.label ?? 'Stable'}</span>
                    </p>
                </div>

                <div className='space-y-1.5'>
                    {CHANNEL_OPTIONS.map((channel) => {
                        const isCurrent = channel.id === currentChannel;
                        return (
                            <button
                                key={channel.id}
                                type='button'
                                className={`w-full rounded-md border px-2 py-2 text-left ${
                                    isCurrent
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-background hover:bg-accent'
                                }`}
                                onClick={() => {
                                    if (isCurrent || setChannelMutation.isPending) {
                                        return;
                                    }

                                    setPendingChannel(channel.id);
                                }}>
                                <p className='text-sm font-medium'>{channel.label}</p>
                                <p className='text-muted-foreground text-xs'>{channel.description}</p>
                            </button>
                        );
                    })}
                </div>

                <div className='mt-3 flex justify-end'>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={checkMutation.isPending}
                        onClick={() => {
                            void checkMutation.mutateAsync();
                        }}>
                        {checkMutation.isPending ? 'Checking...' : 'Check for updates'}
                    </Button>
                </div>
            </section>

            <ConfirmDialog
                open={pendingChannel !== null}
                title='Switch update channel?'
                message='Switching channels can move to newer or older builds and may affect in-progress features.'
                confirmLabel='Switch channel'
                cancelLabel='Cancel'
                destructive={pendingChannel === 'alpha'}
                busy={setChannelMutation.isPending}
                onCancel={() => {
                    if (setChannelMutation.isPending) {
                        return;
                    }

                    setPendingChannel(null);
                }}
                onConfirm={() => {
                    if (!pendingChannel) {
                        return;
                    }

                    void setChannelMutation.mutateAsync(pendingChannel).finally(() => {
                        setPendingChannel(null);
                    });
                }}
            />
        </>
    );
}
