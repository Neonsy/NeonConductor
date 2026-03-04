import type { ReactNode } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps): ReactNode {
    if (!open) {
        return null;
    }

    return (
        <div className='bg-background/70 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm'>
            <section className='border-border bg-card text-card-foreground w-full max-w-sm rounded-xl border p-5 shadow-xl'>
                <h2 className='text-base font-semibold'>{title}</h2>
                <p className='text-muted-foreground mt-2 text-sm'>{message}</p>
                <div className='mt-5 flex justify-end gap-2'>
                    <button
                        type='button'
                        className='border-border bg-background hover:bg-accent rounded-md border px-3 py-1.5 text-sm'
                        onClick={onCancel}
                        disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button
                        type='button'
                        className={`rounded-md px-3 py-1.5 text-sm text-white ${
                            destructive ? 'bg-destructive hover:bg-destructive/85' : 'bg-primary hover:bg-primary/85'
                        }`}
                        onClick={onConfirm}
                        disabled={busy}>
                        {busy ? 'Working...' : confirmLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}
