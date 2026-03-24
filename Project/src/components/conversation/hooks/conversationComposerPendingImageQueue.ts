import {
    MAX_COMPOSER_TOTAL_IMAGE_BYTES,
    summarizeReadyImageBytes,
    type ComposerPendingImage,
    type PreparedComposerImageAttachment,
} from '@/web/components/conversation/hooks/composerImageAttachments';

function toFailedImageState(image: ComposerPendingImage, errorMessage: string): ComposerPendingImage {
    return {
        clientId: image.clientId,
        fileName: image.fileName,
        sourceFile: image.sourceFile,
        previewUrl: image.previewUrl,
        status: 'failed',
        errorMessage,
    };
}

function toQueuedImageState(image: ComposerPendingImage): ComposerPendingImage {
    return {
        clientId: image.clientId,
        fileName: image.fileName,
        sourceFile: image.sourceFile,
        previewUrl: image.previewUrl,
        status: 'queued',
    };
}

function toCompressingImageState(image: ComposerPendingImage): ComposerPendingImage {
    return {
        clientId: image.clientId,
        fileName: image.fileName,
        sourceFile: image.sourceFile,
        previewUrl: image.previewUrl,
        status: 'compressing',
    };
}

export interface ComposerPendingImagePumpResult {
    nextImages: ComposerPendingImage[];
    imagesToStart: ComposerPendingImage[];
}

export interface ResolvePreparedComposerPendingImageResult {
    nextImages: ComposerPendingImage[];
    replacedImage?: ComposerPendingImage;
    errorMessage?: string;
}

export function pumpComposerPendingImages(
    images: ComposerPendingImage[],
    imageCompressionConcurrency: number
): ComposerPendingImagePumpResult {
    const activeCompressionCount = images.filter((image) => image.status === 'compressing').length;
    const availableCompressionSlots = Math.max(0, imageCompressionConcurrency - activeCompressionCount);

    if (availableCompressionSlots === 0) {
        return {
            nextImages: images,
            imagesToStart: [],
        };
    }

    const queuedImageIds = new Set(
        images
            .filter((image) => image.status === 'queued')
            .slice(0, availableCompressionSlots)
            .map((image) => image.clientId)
    );

    if (queuedImageIds.size === 0) {
        return {
            nextImages: images,
            imagesToStart: [],
        };
    }

    const nextImages = images.map((image) =>
        queuedImageIds.has(image.clientId) ? toCompressingImageState(image) : image
    );

    return {
        nextImages,
        imagesToStart: nextImages.filter((image) => queuedImageIds.has(image.clientId)),
    };
}

export function queueComposerPendingImageForRetry(
    images: ComposerPendingImage[],
    clientId: string
): ComposerPendingImage[] {
    return images.map((image) => (image.clientId === clientId ? toQueuedImageState(image) : image));
}

export function failComposerPendingImage(
    images: ComposerPendingImage[],
    clientId: string,
    errorMessage: string
): ComposerPendingImage[] {
    return images.map((image) => (image.clientId === clientId ? toFailedImageState(image, errorMessage) : image));
}

export function resolvePreparedComposerPendingImage(
    images: ComposerPendingImage[],
    clientId: string,
    prepared: PreparedComposerImageAttachment
): ResolvePreparedComposerPendingImageResult {
    const existingImage = images.find((image) => image.clientId === clientId);
    if (!existingImage) {
        return {
            nextImages: images,
        };
    }

    const nextTotalBytes = summarizeReadyImageBytes(images, clientId) + prepared.byteSize;
    if (nextTotalBytes > MAX_COMPOSER_TOTAL_IMAGE_BYTES) {
        return {
            nextImages: failComposerPendingImage(
                images,
                clientId,
                'Attached images exceed the 6 MB total payload limit.'
            ),
            errorMessage: 'Attached images exceed the 6 MB total payload limit.',
        };
    }

    return {
        nextImages: images.map((image) =>
            image.clientId === clientId
                ? {
                      ...image,
                      previewUrl: prepared.previewUrl,
                      status: 'ready',
                      attachment: prepared.attachment,
                      byteSize: prepared.byteSize,
                  }
                : image
        ),
        replacedImage: existingImage,
    };
}
