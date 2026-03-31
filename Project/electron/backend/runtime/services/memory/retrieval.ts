import { advancedMemoryDerivationService } from '@/app/backend/runtime/services/memory/advancedDerivation';
import { assembleMemoryRetrievalResult } from '@/app/backend/runtime/services/memory/memoryRetrievalAssemblyStage';
import { collectMemoryRetrievalCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalCandidateCollector';
import { resolveMemoryRetrievalContext } from '@/app/backend/runtime/services/memory/memoryRetrievalContextResolver';
import { loadMemoryRetrievalEvidence } from '@/app/backend/runtime/services/memory/memoryRetrievalEvidenceStage';
import { expandMemoryRetrievalCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalExpansionStage';
import type { MemoryRetrievalStageInput } from '@/app/backend/runtime/services/memory/memoryRetrievalPipelineTypes';
import { rankRetrievedMemoryCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalRankingPolicy';
import { collectSemanticMemoryRetrievalCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalSemanticStage';
import { selectRetrievedMemoryCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalSelectionStage';
import { resolveTemporalMemoryCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalTemporalResolutionStage';
import { appLog } from '@/app/main/logging';

import type { RetrievedMemorySummary } from '@/app/backend/runtime/contracts';
import type { RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';

export type RetrieveRelevantMemoryInput = MemoryRetrievalStageInput;

export interface RetrieveRelevantMemoryResult {
    summary?: RetrievedMemorySummary;
    messages: RunContextMessage[];
}

export class MemoryRetrievalService {
    async retrieveRelevantMemory(input: RetrieveRelevantMemoryInput): Promise<RetrieveRelevantMemoryResult> {
        const context = await resolveMemoryRetrievalContext(input);
        const collected = await collectMemoryRetrievalCandidates(context);
        const expanded = await expandMemoryRetrievalCandidates({
            context,
            baseCandidates: collected.baseCandidates,
        });
        const semantic = await collectSemanticMemoryRetrievalCandidates({
            profileId: input.profileId,
            prompt: input.prompt,
            activeMemories: context.activeMemories,
            excludedMemoryIds: new Set([
                ...expanded.baseCandidates.map((candidate) => candidate.memory.id),
                ...expanded.derivedCandidates.map((candidate) => candidate.memory.id),
            ]),
        });
        const orderedCandidates = rankRetrievedMemoryCandidates({
            baseCandidates: expanded.baseCandidates,
            activeMemories: context.activeMemories,
            promptTerms: context.promptTerms,
            derivedCandidates: expanded.derivedCandidates,
            semanticCandidates: semantic.semanticCandidates,
        });
        const initialDerivedSummaryResult = await advancedMemoryDerivationService.getDerivedSummaries(
            input.profileId,
            orderedCandidates.map((candidate) => candidate.memory.id)
        );
        const initialDerivedSummaryByMemoryId = initialDerivedSummaryResult.isOk()
            ? initialDerivedSummaryResult.value
            : new Map();
        if (initialDerivedSummaryResult.isErr()) {
            appLog.warn({
                tag: 'memory.retrieval.temporal_resolution',
                message: 'Derived summaries failed softly before temporal resolution.',
                profileId: input.profileId,
                errorCode: initialDerivedSummaryResult.error.code,
                detail: initialDerivedSummaryResult.error.message,
            });
        }
        const temporallyResolvedCandidates = resolveTemporalMemoryCandidates({
            prompt: input.prompt,
            activeMemories: context.activeMemories,
            decisions: orderedCandidates,
            derivedSummaryByMemoryId: initialDerivedSummaryByMemoryId,
        });
        const finalDerivedSummaryResult = await advancedMemoryDerivationService.getDerivedSummaries(
            input.profileId,
            temporallyResolvedCandidates.decisions.map((candidate) => candidate.memory.id)
        );
        const derivedSummaryByMemoryId = finalDerivedSummaryResult.isOk()
            ? finalDerivedSummaryResult.value
            : initialDerivedSummaryByMemoryId;
        if (finalDerivedSummaryResult.isErr()) {
            appLog.warn({
                tag: 'memory.retrieval.selection',
                message: 'Derived summaries failed softly before memory selection.',
                profileId: input.profileId,
                errorCode: finalDerivedSummaryResult.error.code,
                detail: finalDerivedSummaryResult.error.message,
            });
        }
        const selectedCandidates = selectRetrievedMemoryCandidates({
            decisions: temporallyResolvedCandidates.decisions,
            derivedSummaryByMemoryId,
            temporalIntent: temporallyResolvedCandidates.temporalIntent,
        }).decisions;
        const evidence = await loadMemoryRetrievalEvidence({
            profileId: input.profileId,
            decisions: selectedCandidates,
        });

        const assembled = await assembleMemoryRetrievalResult({
            profileId: input.profileId,
            decisions: selectedCandidates,
            evidenceByMemoryId: evidence.evidenceByMemoryId,
            derivedSummaryByMemoryId,
        });

        return {
            messages: assembled.messages,
            ...(assembled.summary ? { summary: assembled.summary } : {}),
        };
    }
}

export const memoryRetrievalService = new MemoryRetrievalService();
