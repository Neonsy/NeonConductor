import { memorySemanticIndexService } from '@/app/backend/runtime/services/memory/memorySemanticIndexService';
import type {
    MemoryRetrievalSemanticStageInput,
    MemoryRetrievalSemanticStageResult,
} from '@/app/backend/runtime/services/memory/memoryRetrievalPipelineTypes';
import { appLog } from '@/app/main/logging';

export async function collectSemanticMemoryRetrievalCandidates(
    input: MemoryRetrievalSemanticStageInput
): Promise<MemoryRetrievalSemanticStageResult> {
    try {
        return {
            semanticCandidates: await memorySemanticIndexService.collectSemanticCandidates({
                profileId: input.profileId,
                prompt: input.prompt,
                activeMemories: input.activeMemories,
                excludedMemoryIds: input.excludedMemoryIds,
            }),
        };
    } catch (error) {
        appLog.warn({
            tag: 'memory.semantic-index.stage',
            message: 'Semantic retrieval stage failed softly.',
            profileId: input.profileId,
            detail: error instanceof Error ? error.message : 'Unknown error.',
        });
        return {
            semanticCandidates: [],
        };
    }
}
