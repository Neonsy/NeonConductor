import { PendingImagesGrid, type PendingImageCardView } from '@/web/components/conversation/panels/composerActionPanel/pendingImagesGrid';
import { ComposerSlashCommandPopup } from '@/web/components/conversation/panels/composerSlashCommandPopup';
import type { ComposerSlashPopupState } from '@/web/components/conversation/panels/composerSlashCommands';

import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

interface ComposerPromptCardProps {
    isDragActive: boolean;
    canAttachImages: boolean;
    imageAttachmentBlockedReason: string | undefined;
    pendingImages: PendingImageCardView[];
    composerErrorMessage: string | undefined;
    composerErrorTone: 'destructive' | 'muted';
    draftPrompt: string;
    promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
    fileInputRef: RefObject<HTMLInputElement | null>;
    slashPopupState: ComposerSlashPopupState;
    onPromptChange: (prompt: string) => void;
    onPromptEdited: () => void;
    onPromptPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onPromptKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onPreviewImage: (image: { imageUrl: string; title: string; detail?: string }) => void;
    onRetryPendingImage: (clientId: string) => void;
    onRemovePendingImage: (clientId: string) => void;
    formatImageBytes: (value?: number) => string | undefined;
}

export function ComposerPromptCard({
    isDragActive,
    canAttachImages,
    imageAttachmentBlockedReason,
    pendingImages,
    composerErrorMessage,
    composerErrorTone,
    draftPrompt,
    promptTextareaRef,
    fileInputRef,
    slashPopupState,
    onPromptChange,
    onPromptEdited,
    onPromptPaste,
    onPromptKeyDown,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileInputChange,
    onPreviewImage,
    onRetryPendingImage,
    onRemovePendingImage,
    formatImageBytes,
}: ComposerPromptCardProps) {
    return (
        <div
            className='space-y-2'
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}>
            <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                className='hidden'
                onChange={onFileInputChange}
            />
            {composerErrorMessage ? (
                <p
                    aria-live='polite'
                    className={`text-xs ${composerErrorTone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {composerErrorMessage}
                </p>
            ) : null}
            <div
                className={`border-border/70 bg-card/35 relative overflow-hidden rounded-[24px] border transition ${
                    isDragActive ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]' : ''
                }`}>
                <ComposerSlashCommandPopup state={slashPopupState} />
                {imageAttachmentBlockedReason && !canAttachImages ? (
                    <p className='text-muted-foreground border-border/60 border-b px-4 py-3 text-xs'>
                        {imageAttachmentBlockedReason}
                    </p>
                ) : null}
                <PendingImagesGrid
                    pendingImages={pendingImages}
                    onPreviewImage={onPreviewImage}
                    onRetryPendingImage={onRetryPendingImage}
                    onRemovePendingImage={onRemovePendingImage}
                    formatImageBytes={formatImageBytes}
                />
                <textarea
                    ref={promptTextareaRef}
                    aria-label='Prompt'
                    name='composerPrompt'
                    value={draftPrompt}
                    onChange={(event) => {
                        if (composerErrorMessage) {
                            onPromptEdited();
                        }
                        onPromptChange(event.target.value);
                    }}
                    onPaste={onPromptPaste}
                    onKeyDown={onPromptKeyDown}
                    rows={4}
                    className='border-border/60 bg-background/75 focus-visible:ring-ring focus-visible:border-ring min-h-[176px] w-full resize-y border-t px-4 py-4 text-sm leading-6 focus-visible:ring-2 focus-visible:outline-none'
                    autoComplete='off'
                    spellCheck
                    placeholder='Type your message here…'
                />
                {isDragActive ? (
                    <div className='bg-primary/10 text-primary pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold backdrop-blur-sm'>
                        Drop images to attach them
                    </div>
                ) : null}
            </div>
        </div>
    );
}
