import { memoryEmbeddingStore, memoryStore, settingsStore } from '@/app/backend/persistence/stores';
import type { MemoryRecord } from '@/app/backend/persistence/types';
import { getConnectionProfileState } from '@/app/backend/providers/service/endpointProfiles';
import { resolveSecret } from '@/app/backend/providers/service/helpers';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import type { MemoryRetrievalSemanticCandidate } from '@/app/backend/runtime/services/memory/memoryRetrievalPipelineTypes';
import {
    buildMemorySemanticIndexedText,
    computeCosineSimilarity,
    createMemorySemanticSourceDigest,
    normalizeEmbeddingVector,
} from '@/app/backend/runtime/services/memory/memorySemanticIndexText';
import { appLog } from '@/app/main/logging';

const MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY = 'memory_retrieval_provider_id';
const MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY = 'memory_retrieval_model_id';
const MINIMUM_SEMANTIC_SIMILARITY = 0.72;
const MAX_SEMANTIC_CANDIDATES = 6;

interface ResolvedMemoryRetrievalTarget {
    providerId: RuntimeProviderId;
    modelId: string;
}

function stripProviderPrefix(input: { providerId: RuntimeProviderId; modelId: string }): string {
    const prefixed = `${input.providerId}/`;
    return input.modelId.startsWith(prefixed) ? input.modelId.slice(prefixed.length) : input.modelId;
}

async function resolveMemoryRetrievalTarget(profileId: string): Promise<ResolvedMemoryRetrievalTarget | null> {
    const [providerIdRaw, modelIdRaw] = await Promise.all([
        settingsStore.getStringOptional(profileId, MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY),
        settingsStore.getStringOptional(profileId, MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY),
    ]);

    const providerId = providerIdRaw?.trim();
    const modelId = modelIdRaw?.trim();
    if (!providerId || !modelId) {
        return null;
    }

    return {
        providerId: providerId as RuntimeProviderId,
        modelId,
    };
}

async function embedOpenAIText(input: {
    profileId: string;
    modelId: string;
    text: string;
}): Promise<OperationalResult<number[]>> {
    const apiKey = await resolveSecret(input.profileId, 'openai', 'api_key');
    if (!apiKey) {
        return errOp('auth_missing', 'OpenAI embedding execution requires an API key.');
    }

    const connectionProfileResult = await getConnectionProfileState(input.profileId, 'openai');
    if (connectionProfileResult.isErr() || !connectionProfileResult.value.resolvedBaseUrl) {
        return errOp(
            connectionProfileResult.isErr() ? connectionProfileResult.error.code : 'request_failed',
            connectionProfileResult.isErr()
                ? connectionProfileResult.error.message
                : 'OpenAI embedding execution requires a resolved base URL.'
        );
    }

    const endpoint = `${connectionProfileResult.value.resolvedBaseUrl}/embeddings`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: stripProviderPrefix({ providerId: 'openai', modelId: input.modelId }),
            input: input.text,
            encoding_format: 'float',
        }),
    }).catch((error: unknown) => errOp('provider_request_failed', error instanceof Error ? error.message : 'Request failed.'));

    if (!('status' in response)) {
        return response;
    }
    if (!response.ok) {
        return errOp('provider_request_failed', `OpenAI embedding request failed with status ${String(response.status)}.`);
    }

    const payload = (await response.json()) as unknown;
    if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray((payload as { data?: unknown }).data) ||
        !Array.isArray(((payload as { data: Array<{ embedding?: unknown }> }).data[0] ?? {}).embedding)
    ) {
        return errOp('provider_request_failed', 'OpenAI embedding response did not include a valid embedding vector.');
    }

    const rawEmbedding = ((payload as { data: Array<{ embedding: unknown[] }> }).data[0]?.embedding ?? []).flatMap(
        (value) => (typeof value === 'number' && Number.isFinite(value) ? [value] : [])
    );
    const normalizedEmbedding = normalizeEmbeddingVector(rawEmbedding);
    if (normalizedEmbedding.length === 0) {
        return errOp('provider_request_failed', 'OpenAI embedding response produced an empty embedding vector.');
    }

    return okOp(normalizedEmbedding);
}

async function embedText(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    text: string;
}): Promise<OperationalResult<number[]>> {
    if (input.providerId === 'openai') {
        return embedOpenAIText({
            profileId: input.profileId,
            modelId: input.modelId,
            text: input.text,
        });
    }

    return errOp(
        'provider_not_supported',
        `Semantic indexing is not supported for provider "${input.providerId}" in this phase.`
    );
}

class MemorySemanticIndexService {
    private async syncMemoryById(profileId: string, memoryId: string): Promise<OperationalResult<void>> {
        const target = await resolveMemoryRetrievalTarget(profileId);
        if (!target) {
            return okOp(undefined);
        }

        const memory = await memoryStore.getById(profileId, memoryId as MemoryRecord['id']);
        if (!memory || memory.state !== 'active') {
            await memoryEmbeddingStore.deleteByMemoryId({
                profileId,
                memoryId,
                providerId: target.providerId,
                modelId: target.modelId,
            });
            return okOp(undefined);
        }

        const indexedText = buildMemorySemanticIndexedText(memory);
        if (indexedText.length === 0) {
            await memoryEmbeddingStore.deleteByMemoryId({
                profileId,
                memoryId: memory.id,
                providerId: target.providerId,
                modelId: target.modelId,
            });
            return okOp(undefined);
        }

        const sourceDigest = createMemorySemanticSourceDigest(indexedText);
        const existing = await memoryEmbeddingStore.getByMemoryId({
            profileId,
            memoryId: memory.id,
            providerId: target.providerId,
            modelId: target.modelId,
        });
        if (existing?.sourceDigest === sourceDigest) {
            return okOp(undefined);
        }

        const embeddingResult = await embedText({
            profileId,
            providerId: target.providerId,
            modelId: target.modelId,
            text: indexedText,
        });
        if (embeddingResult.isErr()) {
            return errOp(embeddingResult.error.code, embeddingResult.error.message);
        }

        await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: target.providerId,
            modelId: target.modelId,
            sourceDigest,
            indexedText,
            embedding: embeddingResult.value,
        });

        return okOp(undefined);
    }

    async refreshMemoryIdsSafely(input: { profileId: string; memoryIds: string[]; reason: string }): Promise<void> {
        for (const memoryId of Array.from(new Set(input.memoryIds))) {
            const result = await this.syncMemoryById(input.profileId, memoryId);
            if (result.isErr()) {
                appLog.warn({
                    tag: 'memory.semantic-index.refresh',
                    message: 'Memory semantic indexing failed softly.',
                    profileId: input.profileId,
                    memoryId,
                    reason: input.reason,
                    errorCode: result.error.code,
                    detail: result.error.message,
                });
            }
        }
    }

    async rebuildProfileIndex(profileId: string): Promise<void> {
        const target = await resolveMemoryRetrievalTarget(profileId);
        if (!target) {
            return;
        }

        await memoryEmbeddingStore.clearProfileModel({
            profileId,
            providerId: target.providerId,
            modelId: target.modelId,
        });
        const activeMemories = await memoryStore.listByProfile({
            profileId,
            state: 'active',
        });

        await this.refreshMemoryIdsSafely({
            profileId,
            memoryIds: activeMemories.map((memory) => memory.id),
            reason: 'profile_rebuild',
        });
    }

    async collectSemanticCandidates(input: {
        profileId: string;
        prompt: string;
        activeMemories: MemoryRecord[];
        excludedMemoryIds: Set<string>;
    }): Promise<MemoryRetrievalSemanticCandidate[]> {
        const target = await resolveMemoryRetrievalTarget(input.profileId);
        if (!target) {
            return [];
        }

        const promptText = input.prompt.trim();
        if (promptText.length === 0) {
            return [];
        }

        const promptEmbeddingResult = await embedText({
            profileId: input.profileId,
            providerId: target.providerId,
            modelId: target.modelId,
            text: promptText,
        });
        if (promptEmbeddingResult.isErr()) {
            appLog.warn({
                tag: 'memory.semantic-index.retrieve',
                message: 'Semantic retrieval prompt embedding failed softly.',
                profileId: input.profileId,
                providerId: target.providerId,
                modelId: target.modelId,
                errorCode: promptEmbeddingResult.error.code,
                detail: promptEmbeddingResult.error.message,
            });
            return [];
        }

        const indexedRecords = await memoryEmbeddingStore
            .listByProviderModel({
                profileId: input.profileId,
                providerId: target.providerId,
                modelId: target.modelId,
            })
            .catch((error: unknown) => {
                appLog.warn({
                    tag: 'memory.semantic-index.retrieve',
                    message: 'Semantic retrieval index loading failed softly.',
                    profileId: input.profileId,
                    providerId: target.providerId,
                    modelId: target.modelId,
                    detail: error instanceof Error ? error.message : 'Unknown error.',
                });
                return [];
            });

        const activeMemoryById = new Map(input.activeMemories.map((memory) => [memory.id, memory] as const));
        return indexedRecords
            .flatMap((record) => {
                if (input.excludedMemoryIds.has(record.memoryId)) {
                    return [];
                }

                const memory = activeMemoryById.get(record.memoryId);
                if (!memory) {
                    return [];
                }

                const similarity = computeCosineSimilarity(promptEmbeddingResult.value, record.embedding);
                if (!Number.isFinite(similarity) || similarity < MINIMUM_SEMANTIC_SIMILARITY) {
                    return [];
                }

                return [
                    {
                        memory,
                        matchReason: 'semantic' as const,
                        tier: 'semantic' as const,
                        similarity,
                    },
                ];
            })
            .sort((left, right) => {
                if (left.similarity !== right.similarity) {
                    return right.similarity - left.similarity;
                }
                if (left.memory.updatedAt !== right.memory.updatedAt) {
                    return right.memory.updatedAt.localeCompare(left.memory.updatedAt);
                }

                return left.memory.id.localeCompare(right.memory.id);
            })
            .slice(0, MAX_SEMANTIC_CANDIDATES);
    }
}

export const memorySemanticIndexService = new MemorySemanticIndexService();
