import { advancedMemoryDerivationService } from '@/app/backend/runtime/services/memory/advancedDerivation';
import { collectMemoryRetrievalCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalCandidateCollector';
import { formatRetrievedMemoryMessage } from '@/app/backend/runtime/services/memory/memoryRetrievalMessageFormatter';
import { rankRetrievedMemoryCandidates } from '@/app/backend/runtime/services/memory/memoryRetrievalRankingPolicy';

import type { RetrievedMemoryRecord, RetrievedMemorySummary } from '@/app/backend/runtime/contracts';
import type { EntityId, TopLevelTab } from '@/app/backend/runtime/contracts';
import type { RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';

export interface RetrieveRelevantMemoryInput {
    profileId: string;
    sessionId: EntityId<'sess'>;
    topLevelTab: TopLevelTab;
    modeKey: string;
    prompt: string;
    workspaceFingerprint?: string;
    runId?: EntityId<'run'>;
}

export interface RetrieveRelevantMemoryResult {
    summary?: RetrievedMemorySummary;
    messages: RunContextMessage[];
}

export class MemoryRetrievalService {
    async retrieveRelevantMemory(input: RetrieveRelevantMemoryInput): Promise<RetrieveRelevantMemoryResult> {
        const collected = await collectMemoryRetrievalCandidates(input);
        const baseCandidateIds = new Set(collected.baseCandidates.map((candidate) => candidate.memory.id));
        const derivedExpansion = await advancedMemoryDerivationService.expandMatchedMemories({
            profileId: input.profileId,
            prompt: input.prompt,
            matchedMemories: collected.baseCandidates.map((candidate) => candidate.memory),
        });

        const baseCandidatesWithAnnotations = collected.baseCandidates.map((candidate) => ({
            ...candidate,
            ...(derivedExpansion.isOk() && derivedExpansion.value.summaries.has(candidate.memory.id)
                ? {
                      annotations:
                          derivedExpansion.value.summaries.get(candidate.memory.id)?.hasTemporalHistory
                              ? ['Current fact has temporal history.']
                              : [],
                  }
                : {}),
        }));

        const orderedCandidates = rankRetrievedMemoryCandidates({
            baseCandidates: baseCandidatesWithAnnotations,
            activeMemories: collected.activeMemories,
            promptTerms: collected.promptTerms,
            derivedCandidates: derivedExpansion.isOk()
                ? derivedExpansion.value.candidates.filter(
                      (candidate) => !baseCandidateIds.has(candidate.memory.id)
                  )
                : [],
        }).slice(0, 6);

        if (orderedCandidates.length === 0) {
            return {
                messages: [],
            };
        }

        const finalDerivedSummaries = await advancedMemoryDerivationService.getDerivedSummaries(
            input.profileId,
            orderedCandidates.map((candidate) => candidate.memory.id)
        );
        const finalDerivedSummaryById = finalDerivedSummaries.isOk() ? finalDerivedSummaries.value : undefined;

        const retrievedRecords: RetrievedMemoryRecord[] = orderedCandidates.map((candidate, index) => {
            const derivedSummary = finalDerivedSummaryById?.get(candidate.memory.id);
            return {
                memoryId: candidate.memory.id,
                title: candidate.memory.title,
                memoryType: candidate.memory.memoryType,
                scopeKind: candidate.memory.scopeKind,
                matchReason: candidate.matchReason,
                order: index + 1,
                ...(candidate.sourceMemoryId ? { sourceMemoryId: candidate.sourceMemoryId } : {}),
                ...(candidate.annotations && candidate.annotations.length > 0
                    ? { annotations: candidate.annotations }
                    : {}),
                ...(derivedSummary ? { derivedSummary } : {}),
            };
        });
        const memoriesById = new Map(
            orderedCandidates.map((candidate) => [candidate.memory.id, candidate.memory] as const)
        );
        const injectedMessage = formatRetrievedMemoryMessage(retrievedRecords, memoriesById);
        if (!injectedMessage) {
            return {
                messages: [],
            };
        }

        return {
            summary: {
                records: retrievedRecords,
                injectedTextLength: injectedMessage.injectedTextLength,
            },
            messages: [injectedMessage.message],
        };
    }
}

export const memoryRetrievalService = new MemoryRetrievalService();

