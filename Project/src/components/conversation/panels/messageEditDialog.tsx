import { useState } from 'react';

interface MessageEditDialogProps {
    open: boolean;
    initialText: string;
    preferredResolution: 'ask' | 'truncate' | 'branch';
    forcedMode?: 'branch';
    busy: boolean;
    onCancel: () => void;
    onSave: (input: { replacementText: string; editMode: 'truncate' | 'branch'; rememberChoice: boolean }) => void;
}

interface MessageEditDraftState {
    replacementText: string;
    editMode: 'truncate' | 'branch';
    rememberChoice: boolean;
}

function resolveInitialMode(input: {
    preferredResolution: 'ask' | 'truncate' | 'branch';
    forcedMode?: 'branch';
}): 'truncate' | 'branch' {
    if (input.forcedMode === 'branch') {
        return 'branch';
    }
    if (input.preferredResolution === 'branch') {
        return 'branch';
    }

    return 'truncate';
}

export function createMessageEditDraftState(input: {
    initialText: string;
    preferredResolution: 'ask' | 'truncate' | 'branch';
    forcedMode?: 'branch';
}): MessageEditDraftState {
    return {
        replacementText: input.initialText,
        editMode: resolveInitialMode({
            preferredResolution: input.preferredResolution,
            ...(input.forcedMode ? { forcedMode: input.forcedMode } : {}),
        }),
        rememberChoice: false,
    };
}

function MessageEditDialogBody({
    initialText,
    preferredResolution,
    forcedMode,
    busy,
    onCancel,
    onSave,
}: Omit<MessageEditDialogProps, 'open'>) {
    const [draftState, setDraftState] = useState(() =>
        createMessageEditDraftState({
            initialText,
            preferredResolution,
            ...(forcedMode ? { forcedMode } : {}),
        })
    );

    const { replacementText, editMode, rememberChoice } = draftState;
    const modeSelectionVisible = preferredResolution === 'ask' && !forcedMode;
    const rememberChoiceVisible = preferredResolution === 'ask' && !forcedMode;
    const modeHelpText =
        editMode === 'branch'
            ? 'Branch mode creates a new session and keeps current session untouched.'
            : 'Truncate mode removes this turn and all turns after it in the target session.';

    return (
        <div className='bg-background/70 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm'>
            <section className='border-border bg-card text-card-foreground w-full max-w-xl rounded-xl border p-5 shadow-xl'>
                <h2 className='text-base font-semibold'>Edit Message</h2>
                <p className='text-muted-foreground mt-2 text-sm'>
                    Saving this edit can change downstream conversation history.
                </p>
                <div className='mt-3 space-y-2'>
                    <textarea
                        rows={6}
                        className='border-border bg-background w-full rounded-md border p-2 text-sm'
                        value={replacementText}
                        onChange={(event) => {
                            setDraftState((current) => ({
                                ...current,
                                replacementText: event.target.value,
                            }));
                        }}
                    />
                    {modeSelectionVisible ? (
                        <div className='flex items-center gap-2'>
                            <button
                                type='button'
                                className={`rounded-md border px-2 py-1 text-xs ${
                                    editMode === 'truncate'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-background'
                                }`}
                                onClick={() => {
                                    setDraftState((current) => ({
                                        ...current,
                                        editMode: 'truncate',
                                    }));
                                }}>
                                Truncate
                            </button>
                            <button
                                type='button'
                                className={`rounded-md border px-2 py-1 text-xs ${
                                    editMode === 'branch'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-background'
                                }`}
                                onClick={() => {
                                    setDraftState((current) => ({
                                        ...current,
                                        editMode: 'branch',
                                    }));
                                }}>
                                Branch
                            </button>
                        </div>
                    ) : null}
                    <p className='text-muted-foreground text-xs'>{modeHelpText}</p>
                    {rememberChoiceVisible ? (
                        <label className='text-muted-foreground flex items-center gap-2 text-xs'>
                            <input
                                type='checkbox'
                                checked={rememberChoice}
                                onChange={(event) => {
                                    setDraftState((current) => ({
                                        ...current,
                                        rememberChoice: event.target.checked,
                                    }));
                                }}
                            />
                            Don&apos;t ask again for this profile
                        </label>
                    ) : null}
                </div>

                <div className='mt-5 flex justify-end gap-2'>
                    <button
                        type='button'
                        className='border-border bg-background hover:bg-accent rounded-md border px-3 py-1.5 text-sm'
                        onClick={onCancel}
                        disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type='button'
                        className='rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500 disabled:opacity-60'
                        disabled={busy || replacementText.trim().length === 0}
                        onClick={() => {
                            onSave({
                                replacementText: replacementText.trim(),
                                editMode,
                                rememberChoice,
                            });
                        }}>
                        {busy ? 'Applying...' : 'Apply Edit'}
                    </button>
                </div>
            </section>
        </div>
    );
}

export function MessageEditDialog({
    open,
    initialText,
    preferredResolution,
    forcedMode,
    busy,
    onCancel,
    onSave,
}: MessageEditDialogProps) {
    if (!open) {
        return null;
    }

    return (
        <MessageEditDialogBody
            initialText={initialText}
            preferredResolution={preferredResolution}
            {...(forcedMode ? { forcedMode } : {})}
            busy={busy}
            onCancel={onCancel}
            onSave={onSave}
        />
    );
}
