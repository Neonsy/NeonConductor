import { memoryStore } from '@/app/backend/persistence/stores';
import type { MemoryProjectionContextInput, MemoryProjectionStatusResult } from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import { advancedMemoryDerivationService } from '@/app/backend/runtime/services/memory/advancedDerivation';
import {
    buildCandidateProjection,
    isMemoryRelevant,
    resolveMemoryProjectionPaths,
    resolveProjectionContext,
    sortProjectedMemories,
} from '@/app/backend/runtime/services/memory/memoryProjectionContextResolver';
import { scanProjectedMemory, writeProjectedMemoryFile, type ScannedProjection } from '@/app/backend/runtime/services/memory/memoryProjectionWriter';
import { appLog } from '@/app/main/logging';

export interface MemoryProjectionSnapshot {
    paths: MemoryProjectionStatusResult['paths'];
    scanned: ScannedProjection[];
}

export async function loadRelevantProjectionSnapshot(
    input: MemoryProjectionContextInput
): Promise<OperationalResult<MemoryProjectionSnapshot>> {
    const resolvedContext = await resolveProjectionContext(input);
    if (resolvedContext.isErr()) {
        return errOp(resolvedContext.error.code, resolvedContext.error.message, {
            ...(resolvedContext.error.details ? { details: resolvedContext.error.details } : {}),
        });
    }

    const [paths, allMemories] = await Promise.all([
        resolveMemoryProjectionPaths({
            profileId: input.profileId,
            ...(resolvedContext.value.workspaceFingerprint
                ? { workspaceFingerprint: resolvedContext.value.workspaceFingerprint }
                : {}),
            ...(input.sandboxId ? { sandboxId: input.sandboxId } : {}),
        }),
        memoryStore.listByProfile({
            profileId: input.profileId,
        }),
    ]);

    const relevantMemories = allMemories
        .filter((memory) => isMemoryRelevant(memory, resolvedContext.value))
        .sort(sortProjectedMemories);
    const derivedSummariesResult = await advancedMemoryDerivationService.getDerivedSummaries(
        input.profileId,
        relevantMemories.map((memory) => memory.id)
    );
    if (derivedSummariesResult.isErr()) {
        appLog.warn({
            tag: 'memory-derived',
            message: 'Advanced memory summaries failed during projection loading; continuing without derived metadata.',
            profileId: input.profileId,
            errorCode: derivedSummariesResult.error.code,
            errorMessage: derivedSummariesResult.error.message,
        });
    }

    const scanned = await Promise.all(
        relevantMemories.map((memory) =>
            scanProjectedMemory(buildCandidateProjection(memory, paths, resolvedContext.value.workspaceFingerprint))
        )
    );

    return okOp({
        paths,
        scanned: scanned.map((item) => {
            const derivedSummary = derivedSummariesResult.isOk()
                ? derivedSummariesResult.value.get(item.projected.memory.id)
                : undefined;

            return {
                ...item,
                projected: derivedSummary ? { ...item.projected, derivedSummary } : item.projected,
            };
        }),
    });
}

export class MemoryProjectionCatalog {
    async listProjectionStatus(
        input: MemoryProjectionContextInput
    ): Promise<OperationalResult<MemoryProjectionStatusResult>> {
        const loaded = await loadRelevantProjectionSnapshot(input);
        if (loaded.isErr()) {
            return errOp(loaded.error.code, loaded.error.message, {
                ...(loaded.error.details ? { details: loaded.error.details } : {}),
            });
        }

        return okOp({
            paths: loaded.value.paths,
            projectedMemories: loaded.value.scanned.map((item) => item.projected),
        });
    }

    async syncProjection(
        input: MemoryProjectionContextInput
    ): Promise<OperationalResult<MemoryProjectionStatusResult>> {
        const loaded = await loadRelevantProjectionSnapshot(input);
        if (loaded.isErr()) {
            return errOp(loaded.error.code, loaded.error.message, {
                ...(loaded.error.details ? { details: loaded.error.details } : {}),
            });
        }

        await Promise.all(
            loaded.value.scanned.map((item) => {
                if (item.projected.syncState === 'edited' || item.projected.syncState === 'parse_error') {
                    return Promise.resolve();
                }

                return writeProjectedMemoryFile({
                    memory: item.projected.memory,
                    projectionTarget: item.projected.projectionTarget,
                    absolutePath: item.projected.absolutePath,
                    relativePath: item.projected.relativePath,
                });
            })
        );

        const refreshed = await this.listProjectionStatus(input);
        if (refreshed.isErr()) {
            return refreshed;
        }

        return okOp(refreshed.value);
    }
}

export const memoryProjectionCatalog = new MemoryProjectionCatalog();
