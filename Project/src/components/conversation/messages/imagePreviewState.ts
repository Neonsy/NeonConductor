import type { ComposerPendingImageStatus } from '@/web/components/conversation/hooks/composerImageAttachments';

export type ImagePreviewState = 'idle' | 'loading' | 'ready' | 'failed';

export function getPendingImagePreviewState(status: ComposerPendingImageStatus): ImagePreviewState {
    if (status === 'ready') {
        return 'ready';
    }

    if (status === 'failed') {
        return 'failed';
    }

    return 'loading';
}

export function getRemoteImagePreviewState(input: {
    enabled: boolean;
    hasObjectUrl: boolean;
    isLoading: boolean;
    found: boolean | undefined;
    hasError: boolean;
}): ImagePreviewState {
    if (input.hasObjectUrl) {
        return 'ready';
    }

    if (input.hasError || input.found === false) {
        return 'failed';
    }

    if (input.isLoading || input.enabled) {
        return 'loading';
    }

    return 'idle';
}

export function getImagePreviewStatusLabel(state: ImagePreviewState): string {
    if (state === 'ready') {
        return 'Ready';
    }

    if (state === 'failed') {
        return 'Needs attention';
    }

    if (state === 'loading') {
        return 'Loading';
    }

    return 'Preview idle';
}
