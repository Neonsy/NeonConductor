import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errOp, okOp } from '@/app/backend/runtime/services/common/operationalError';

const { resolveSummaryGenerationTargetMock, generatePlainTextFromMessagesMock, debugMock } = vi.hoisted(() => ({
    resolveSummaryGenerationTargetMock: vi.fn(),
    generatePlainTextFromMessagesMock: vi.fn(),
    debugMock: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/common/summaryGenerationTarget', () => ({
    resolveSummaryGenerationTarget: resolveSummaryGenerationTargetMock,
}));

vi.mock('@/app/backend/runtime/services/common/plainTextGeneration', () => ({
    generatePlainTextFromMessages: generatePlainTextFromMessagesMock,
}));

vi.mock('@/app/main/logging', () => ({
    appLog: {
        debug: debugMock,
    },
}));

import { artifactSummaryService } from '@/app/backend/runtime/services/toolExecution/artifactSummaryService';

describe('artifactSummaryService', () => {
    beforeEach(() => {
        resolveSummaryGenerationTargetMock.mockReset();
        generatePlainTextFromMessagesMock.mockReset();
        debugMock.mockReset();
    });

    it('returns not_eligible for non-command artifact kinds', async () => {
        const result = await artifactSummaryService.summarizeArtifact({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            artifactCandidate: {
                kind: 'file_read',
                contentType: 'text/plain',
                rawText: 'file body',
                metadata: {
                    path: 'README.md',
                    byteLength: 9,
                    lineCount: 1,
                    omittedBytes: 0,
                    previewTruncated: false,
                },
            },
        });

        expect(result).toEqual({ kind: 'not_eligible' });
        expect(resolveSummaryGenerationTargetMock).not.toHaveBeenCalled();
        expect(generatePlainTextFromMessagesMock).not.toHaveBeenCalled();
    });

    it('uses the resolved Utility AI target when semantic summary generation succeeds', async () => {
        resolveSummaryGenerationTargetMock.mockResolvedValue({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
        generatePlainTextFromMessagesMock.mockResolvedValue(okOp('## Command summary\n- Exit code: 1'));

        const result = await artifactSummaryService.summarizeArtifact({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            artifactCandidate: {
                kind: 'command_output',
                contentType: 'text/plain',
                rawText: '{"command":"pnpm test","stderr":"boom"}',
                metadata: {
                    command: 'pnpm test',
                    cwd: 'C:/workspace',
                    exitCode: 1,
                    timedOut: false,
                    durationMs: 42,
                    stdoutBytes: 0,
                    stderrBytes: 4,
                    totalBytes: 4,
                    stdoutLines: 0,
                    stderrLines: 1,
                    totalLines: 1,
                    omittedBytes: 0,
                },
            },
        });

        expect(resolveSummaryGenerationTargetMock).toHaveBeenCalledWith({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            summaryMessages: expect.any(Array),
            requireFallbackFit: true,
        });
        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                profileId: 'profile_test',
                providerId: 'zai',
                modelId: 'zai/glm-4.5-air',
                timeoutMs: 15_000,
            })
        );
        expect(result).toEqual({
            kind: 'summary_generated',
            summaryText: '## Command summary\n- Exit code: 1',
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
    });

    it('falls back to the active run model when the resolved target is fallback', async () => {
        resolveSummaryGenerationTargetMock.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });
        generatePlainTextFromMessagesMock.mockResolvedValue(okOp('## Build summary\n- Tests failed'));

        const result = await artifactSummaryService.summarizeArtifact({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            artifactCandidate: {
                kind: 'command_output',
                contentType: 'text/plain',
                rawText: '{"command":"pnpm test","stderr":"boom"}',
                metadata: {
                    command: 'pnpm test',
                    cwd: 'C:/workspace',
                    exitCode: 1,
                    timedOut: false,
                    durationMs: 42,
                    stdoutBytes: 0,
                    stderrBytes: 4,
                    totalBytes: 4,
                    stdoutLines: 0,
                    stderrLines: 1,
                    totalLines: 1,
                    omittedBytes: 0,
                },
            },
        });

        expect(result).toEqual({
            kind: 'summary_generated',
            summaryText: '## Build summary\n- Tests failed',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });
    });

    it('falls back to deterministic preview when no usable summary target exists', async () => {
        resolveSummaryGenerationTargetMock.mockResolvedValue(null);

        const result = await artifactSummaryService.summarizeArtifact({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            artifactCandidate: {
                kind: 'command_output',
                contentType: 'text/plain',
                rawText: '{"command":"pnpm test","stderr":"boom"}',
                metadata: {
                    command: 'pnpm test',
                    cwd: 'C:/workspace',
                    exitCode: 1,
                    timedOut: false,
                    durationMs: 42,
                    stdoutBytes: 0,
                    stderrBytes: 4,
                    totalBytes: 4,
                    stdoutLines: 0,
                    stderrLines: 1,
                    totalLines: 1,
                    omittedBytes: 0,
                },
            },
        });

        expect(result).toEqual({
            kind: 'fallback_deterministic',
            reason: 'no_usable_target',
        });
        expect(generatePlainTextFromMessagesMock).not.toHaveBeenCalled();
    });

    it('falls back to deterministic preview when generation fails', async () => {
        resolveSummaryGenerationTargetMock.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });
        generatePlainTextFromMessagesMock.mockResolvedValue(
            errOp('provider_request_failed', 'request failed')
        );

        const result = await artifactSummaryService.summarizeArtifact({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            artifactCandidate: {
                kind: 'command_output',
                contentType: 'text/plain',
                rawText: '{"command":"pnpm test","stderr":"boom"}',
                metadata: {
                    command: 'pnpm test',
                    cwd: 'C:/workspace',
                    exitCode: 1,
                    timedOut: false,
                    durationMs: 42,
                    stdoutBytes: 0,
                    stderrBytes: 4,
                    totalBytes: 4,
                    stdoutLines: 0,
                    stderrLines: 1,
                    totalLines: 1,
                    omittedBytes: 0,
                },
            },
        });

        expect(result).toEqual({
            kind: 'fallback_deterministic',
            reason: 'generation_failed',
        });
    });
});
