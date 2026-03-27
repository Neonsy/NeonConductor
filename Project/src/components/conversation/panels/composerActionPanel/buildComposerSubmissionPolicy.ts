import type { ComposerActionPanelProps, ComposerSubmissionPolicy } from '@/web/components/conversation/panels/composerActionPanel/types';

export function buildComposerSubmissionPolicy(
    input: Pick<
        ComposerActionPanelProps,
        | 'pendingImages'
        | 'canAttachImages'
        | 'imageAttachmentBlockedReason'
        | 'selectedModelCompatibilityState'
        | 'selectedModelCompatibilityReason'
        | 'runErrorMessage'
        | 'maxImageAttachmentsPerMessage'
    > & {
        draftPrompt: string;
        composerSubmitDisabled: boolean;
        slashCommandError?: string;
        isSubmitting: boolean;
    }
): ComposerSubmissionPolicy {
    const hasBlockingPendingImages = input.pendingImages.some((image) => image.status !== 'ready');
    const hasSubmittableContent =
        input.draftPrompt.trim().length > 0 || input.pendingImages.some((image) => image.status === 'ready');
    const hasUnsupportedPendingImages = input.pendingImages.length > 0 && !input.canAttachImages;
    const attachmentStatusMessage = hasUnsupportedPendingImages
        ? (input.imageAttachmentBlockedReason ?? 'Select a vision-capable model to send attached images.')
        : input.selectedModelCompatibilityState === 'incompatible' && input.selectedModelCompatibilityReason
          ? input.selectedModelCompatibilityReason
          : hasBlockingPendingImages
            ? 'Sending is locked until every image finishes processing.'
            : input.pendingImages.length > 0
              ? 'Images are ready to send with this message.'
              : input.canAttachImages
                ? `Attach up to ${String(input.maxImageAttachmentsPerMessage)} images or send text-only.`
                : 'Text-only prompt.';
    const composerFooterMessage = input.composerSubmitDisabled
        ? 'Create or select a thread before you start the run.'
        : attachmentStatusMessage;

    return {
        hasBlockingPendingImages,
        hasSubmittableContent,
        hasUnsupportedPendingImages,
        canSubmit:
            !input.composerSubmitDisabled &&
            !input.isSubmitting &&
            hasSubmittableContent &&
            !hasBlockingPendingImages &&
            !hasUnsupportedPendingImages &&
            input.selectedModelCompatibilityState !== 'incompatible',
        attachmentStatusMessage,
        composerFooterMessage,
        composerErrorMessage: input.slashCommandError ?? input.runErrorMessage,
    };
}
