import { memoryEvidenceStore } from '@/app/backend/persistence/stores';
import type { EntityId, MemoryEvidenceSummary } from '@/app/backend/runtime/contracts';
import type {
    MemoryRetrievalEvidenceStageInput,
    MemoryRetrievalEvidenceStageResult,
} from '@/app/backend/runtime/services/memory/memoryRetrievalPipelineTypes';

function toMemoryEvidenceSummary(evidence: {
    id: EntityId<'mev'>;
    kind: MemoryEvidenceSummary['kind'];
    label: string;
    excerptText?: string;
    sourceRunId?: EntityId<'run'>;
    sourceMessageId?: EntityId<'msg'>;
    sourceMessagePartId?: EntityId<'part'>;
}): MemoryEvidenceSummary {
    return {
        id: evidence.id,
        kind: evidence.kind,
        label: evidence.label,
        ...(evidence.excerptText ? { excerptText: evidence.excerptText } : {}),
        ...(evidence.sourceRunId ? { sourceRunId: evidence.sourceRunId } : {}),
        ...(evidence.sourceMessageId ? { sourceMessageId: evidence.sourceMessageId } : {}),
        ...(evidence.sourceMessagePartId ? { sourceMessagePartId: evidence.sourceMessagePartId } : {}),
    };
}

export async function loadMemoryRetrievalEvidence(
    input: MemoryRetrievalEvidenceStageInput
): Promise<MemoryRetrievalEvidenceStageResult> {
    if (input.decisions.length === 0) {
        return {
            evidenceByMemoryId: new Map(),
        };
    }

    try {
        const evidence = await memoryEvidenceStore.listByMemoryIds(
            input.profileId,
            input.decisions.map((decision) => decision.memory.id)
        );
        const evidenceByMemoryId = new Map<EntityId<'mem'>, MemoryEvidenceSummary[]>();

        for (const record of evidence) {
            const existing = evidenceByMemoryId.get(record.memoryId) ?? [];
            existing.push(toMemoryEvidenceSummary(record));
            evidenceByMemoryId.set(record.memoryId, existing);
        }

        return {
            evidenceByMemoryId,
        };
    } catch {
        return {
            evidenceByMemoryId: new Map(),
        };
    }
}
