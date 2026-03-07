import { Button } from '@/web/components/ui/button';

import type { PermissionRecord } from '@/app/backend/persistence/types';

interface PendingPermissionsPanelProps {
    requests: PermissionRecord[];
    busy: boolean;
    onResolve: (
        requestId: PermissionRecord['id'],
        resolution: 'deny' | 'allow_once' | 'allow_profile' | 'allow_workspace'
    ) => void;
}

function resolutionLabel(resolution: 'deny' | 'allow_once' | 'allow_profile' | 'allow_workspace'): string {
    if (resolution === 'deny') {
        return 'Deny';
    }
    if (resolution === 'allow_once') {
        return 'Allow Once';
    }
    if (resolution === 'allow_profile') {
        return 'Allow Profile';
    }

    return 'Allow Workspace';
}

export function PendingPermissionsPanel({ requests, busy, onResolve }: PendingPermissionsPanelProps) {
    if (requests.length === 0) {
        return null;
    }

    return (
        <section className='mb-3 space-y-2'>
            {requests.map((request) => (
                <article key={request.id} className='border-border bg-card rounded-xl border p-3 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                            <p className='text-sm font-semibold'>{request.summary.title}</p>
                            <p className='text-muted-foreground mt-1 text-xs'>{request.summary.detail}</p>
                            <p className='text-muted-foreground mt-2 text-[11px]'>
                                {request.resource}
                                {request.workspaceFingerprint ? ` · workspace ${request.workspaceFingerprint}` : ''}
                            </p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={busy}
                                onClick={() => {
                                    onResolve(request.id, 'deny');
                                }}>
                                {resolutionLabel('deny')}
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={busy}
                                onClick={() => {
                                    onResolve(request.id, 'allow_once');
                                }}>
                                {resolutionLabel('allow_once')}
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={busy}
                                onClick={() => {
                                    onResolve(request.id, 'allow_profile');
                                }}>
                                {resolutionLabel('allow_profile')}
                            </Button>
                            {request.workspaceFingerprint ? (
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={busy}
                                    onClick={() => {
                                        onResolve(request.id, 'allow_workspace');
                                    }}>
                                    {resolutionLabel('allow_workspace')}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </article>
            ))}
        </section>
    );
}
