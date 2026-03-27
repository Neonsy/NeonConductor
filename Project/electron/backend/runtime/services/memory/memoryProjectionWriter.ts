import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectedMemoryRecord } from '@/app/backend/runtime/contracts';
import type { CandidateProjection } from '@/app/backend/runtime/services/memory/memoryProjectionContextResolver';
import { hashContent, normalizeContent, parseMemoryProposal, renderProjectedMemoryFile } from '@/app/backend/runtime/services/memory/memoryProjectionFileCodec';

export interface ScannedProjection {
    projected: ProjectedMemoryRecord;
    expectedContent: string;
    currentContent?: string;
}

export async function writeProjectedMemoryFile(candidate: CandidateProjection): Promise<void> {
    await mkdir(path.dirname(candidate.absolutePath), { recursive: true });
    await writeFile(candidate.absolutePath, renderProjectedMemoryFile(candidate.memory), 'utf8');
}

export async function scanProjectedMemory(candidate: CandidateProjection): Promise<ScannedProjection> {
    const expectedContent = renderProjectedMemoryFile(candidate.memory);

    try {
        const [fileStats, currentContent] = await Promise.all([
            stat(candidate.absolutePath),
            readFile(candidate.absolutePath, 'utf8'),
        ]);
        const normalizedCurrentContent = normalizeContent(currentContent);
        const observedContentHash = hashContent(normalizedCurrentContent);

        if (normalizedCurrentContent === expectedContent) {
            return {
                projected: {
                    memory: candidate.memory,
                    projectionTarget: candidate.projectionTarget,
                    absolutePath: candidate.absolutePath,
                    relativePath: candidate.relativePath,
                    syncState: 'in_sync',
                    fileExists: true,
                    fileUpdatedAt: fileStats.mtime.toISOString(),
                    observedContentHash,
                },
                expectedContent,
                currentContent: normalizedCurrentContent,
            };
        }

        try {
            parseMemoryProposal(candidate.memory, normalizedCurrentContent);
            return {
                projected: {
                    memory: candidate.memory,
                    projectionTarget: candidate.projectionTarget,
                    absolutePath: candidate.absolutePath,
                    relativePath: candidate.relativePath,
                    syncState: 'edited',
                    fileExists: true,
                    fileUpdatedAt: fileStats.mtime.toISOString(),
                    observedContentHash,
                },
                expectedContent,
                currentContent: normalizedCurrentContent,
            };
        } catch (error) {
            return {
                projected: {
                    memory: candidate.memory,
                    projectionTarget: candidate.projectionTarget,
                    absolutePath: candidate.absolutePath,
                    relativePath: candidate.relativePath,
                    syncState: 'parse_error',
                    fileExists: true,
                    fileUpdatedAt: fileStats.mtime.toISOString(),
                    observedContentHash,
                    parseError: error instanceof Error ? error.message : 'Projected memory file could not be parsed.',
                },
                expectedContent,
                currentContent: normalizedCurrentContent,
            };
        }
    } catch {
        return {
            projected: {
                memory: candidate.memory,
                projectionTarget: candidate.projectionTarget,
                absolutePath: candidate.absolutePath,
                relativePath: candidate.relativePath,
                syncState: 'not_projected',
                fileExists: false,
            },
            expectedContent,
        };
    }
}
