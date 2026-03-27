import { memoryProjectionCatalog } from '@/app/backend/runtime/services/memory/memoryProjectionCatalog';
import { memoryProjectionReviewController } from '@/app/backend/runtime/services/memory/memoryProjectionReviewController';

export { readParsedState } from '@/app/backend/runtime/services/memory/memoryProjectionFileCodec';

class MemoryProjectionService {
    async listProjectionStatus(input: Parameters<typeof memoryProjectionCatalog.listProjectionStatus>[0]) {
        return memoryProjectionCatalog.listProjectionStatus(input);
    }

    async syncProjection(input: Parameters<typeof memoryProjectionCatalog.syncProjection>[0]) {
        return memoryProjectionCatalog.syncProjection(input);
    }

    async scanProjectionEdits(input: Parameters<typeof memoryProjectionReviewController.scanProjectionEdits>[0]) {
        return memoryProjectionReviewController.scanProjectionEdits(input);
    }

    async applyProjectionEditProposal(
        input: Parameters<typeof memoryProjectionReviewController.applyProjectionEditProposal>[0]
    ) {
        return memoryProjectionReviewController.applyProjectionEditProposal(input);
    }
}

export const memoryProjectionService = new MemoryProjectionService();
