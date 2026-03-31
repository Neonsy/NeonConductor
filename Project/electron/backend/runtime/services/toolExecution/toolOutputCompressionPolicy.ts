import { Buffer } from 'node:buffer';

import type { ToolResultArtifactRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { serializeToolInvocationOutcome } from '@/app/backend/runtime/services/toolExecution/results';
import { artifactSummaryService } from '@/app/backend/runtime/services/toolExecution/artifactSummaryService';
import type {
    ToolExecutionArtifactCandidate,
    ToolExecutionOutput,
    ToolExecutionResult,
    ToolInvocationOutcome,
    ToolOutputEntry,
} from '@/app/backend/runtime/services/toolExecution/types';

const COMMAND_OUTPUT_PREVIEW_MAX_BYTES_PER_STREAM = 12_000;
const COMMAND_OUTPUT_ARTIFACT_THRESHOLD_BYTES = 32_000;
const FILE_READ_PREVIEW_MAX_BYTES = 12_000;
const FILE_READ_ARTIFACT_THRESHOLD_BYTES = 32_000;
const DIRECTORY_LISTING_PREVIEW_MAX_ENTRIES = 50;
const DIRECTORY_LISTING_ARTIFACT_THRESHOLD_BYTES = 16_000;
const DIRECTORY_LISTING_ARTIFACT_THRESHOLD_COUNT = 200;
const HEAD_TAIL_MARKER_TEMPLATE = '\n\n... {BYTES} bytes omitted ...\n\n';
const HEAD_ONLY_MARKER_TEMPLATE = '\n\n... {BYTES} bytes omitted ...';

type ArtifactKind = ToolResultArtifactRecord['artifactKind'];
type PreviewStrategy = ToolResultArtifactRecord['previewStrategy'];

export interface ToolResultArtifactPayloadMetadata {
    artifactized: boolean;
    artifactKind?: ArtifactKind;
    previewStrategy?: PreviewStrategy;
    totalBytes?: number;
    totalLines?: number;
    omittedBytes?: number;
    artifactAvailable?: boolean;
    summaryMode?: 'deterministic' | 'utility_ai';
    summaryProviderId?: RuntimeProviderId;
    summaryModelId?: string;
    deterministicPreviewAvailable?: boolean;
}

export interface ToolResultArtifactPersistenceCandidate {
    profileId: string;
    sessionId: string;
    runId: string;
    toolName: string;
    artifactKind: ArtifactKind;
    contentType: string;
    rawText: string;
    totalBytes: number;
    totalLines: number;
    previewText: string;
    previewStrategy: PreviewStrategy;
    metadata: Record<string, unknown>;
}

export interface PreparedToolResultPersistence {
    outputText: string;
    isError: boolean;
    normalizedPayload: Record<string, unknown>;
    payloadArtifactMetadata: ToolResultArtifactPayloadMetadata;
    artifactPersistenceCandidate?: ToolResultArtifactPersistenceCandidate;
}

interface TextPreview {
    previewText: string;
    totalBytes: number;
    totalLines: number;
    omittedBytes: number;
    truncated: boolean;
}

interface RawRunCommandExecution {
    command: string;
    cwd: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    durationMs: number;
}

interface RawReadFileExecution {
    path: string;
    rawText: string;
    byteLength: number;
    requestedPreviewMaxBytes?: number;
}

interface RawDirectoryListingExecution {
    rootPath: string;
    entries: ToolOutputEntry[];
    truncated: boolean;
    count: number;
}

interface ArtifactizedCandidateDetails {
    candidate: ToolExecutionArtifactCandidate;
    previewStrategy: PreviewStrategy;
    totalBytes: number;
    totalLines: number;
    omittedBytes: number;
}

function countLines(text: string): number {
    if (text.length === 0) {
        return 0;
    }

    return text.split(/\r\n|\r|\n/u).length;
}

function buildHeadTailPreviewText(text: string, maxBytes: number): TextPreview {
    const totalBytes = Buffer.byteLength(text, 'utf8');
    const totalLines = countLines(text);
    if (totalBytes <= maxBytes) {
        return {
            previewText: text,
            totalBytes,
            totalLines,
            omittedBytes: 0,
            truncated: false,
        };
    }

    const omittedBytes = totalBytes - maxBytes;
    const marker = HEAD_TAIL_MARKER_TEMPLATE.replace('{BYTES}', String(omittedBytes));
    const markerBytes = Buffer.byteLength(marker, 'utf8');
    const availableBytes = Math.max(0, maxBytes - markerBytes);
    const headBytes = Math.ceil(availableBytes * 0.6);
    const tailBytes = Math.max(0, availableBytes - headBytes);
    const buffer = Buffer.from(text, 'utf8');
    const headText = buffer.subarray(0, headBytes).toString('utf8');
    const tailText = tailBytes > 0 ? buffer.subarray(buffer.byteLength - tailBytes).toString('utf8') : '';

    return {
        previewText: `${headText}${marker}${tailText}`,
        totalBytes,
        totalLines,
        omittedBytes,
        truncated: true,
    };
}

function buildHeadOnlyPreviewText(text: string, maxBytes: number): TextPreview {
    const totalBytes = Buffer.byteLength(text, 'utf8');
    const totalLines = countLines(text);
    if (totalBytes <= maxBytes) {
        return {
            previewText: text,
            totalBytes,
            totalLines,
            omittedBytes: 0,
            truncated: false,
        };
    }

    const omittedBytes = totalBytes - maxBytes;
    const marker = HEAD_ONLY_MARKER_TEMPLATE.replace('{BYTES}', String(omittedBytes));
    const markerBytes = Buffer.byteLength(marker, 'utf8');
    const availableBytes = Math.max(0, maxBytes - markerBytes);
    const buffer = Buffer.from(text, 'utf8');
    const headText = buffer.subarray(0, availableBytes).toString('utf8');

    return {
        previewText: `${headText}${marker}`,
        totalBytes,
        totalLines,
        omittedBytes,
        truncated: true,
    };
}

function buildDirectoryListingRawText(input: RawDirectoryListingExecution): string {
    return JSON.stringify(
        {
            rootPath: input.rootPath,
            entries: input.entries,
            truncated: input.truncated,
            count: input.count,
        },
        null,
        2
    );
}

function buildDirectoryListingPreviewEntries(entries: ToolOutputEntry[]): ToolOutputEntry[] {
    return entries.slice(0, DIRECTORY_LISTING_PREVIEW_MAX_ENTRIES);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createExecutedPayload(serializedResult: Extract<ToolExecutionResult, { ok: true }>): Record<string, unknown> {
    return {
        ok: true,
        toolId: serializedResult.toolId,
        output: serializedResult.output,
        at: serializedResult.at,
        policy: serializedResult.policy,
    };
}

function createFailedPayload(serializedResult: Extract<ToolExecutionResult, { ok: false }>): Record<string, unknown> {
    return {
        ok: false,
        toolId: serializedResult.toolId,
        error: serializedResult.error,
        message: serializedResult.message,
        args: serializedResult.args,
        at: serializedResult.at,
        ...(serializedResult.policy ? { policy: serializedResult.policy } : {}),
        ...(serializedResult.requestId ? { requestId: serializedResult.requestId } : {}),
    };
}

export function createRunCommandExecutionOutput(
    input: RawRunCommandExecution
): { output: ToolExecutionOutput; artifactCandidate: ToolExecutionArtifactCandidate } {
    const stdoutPreview = buildHeadTailPreviewText(input.stdout, COMMAND_OUTPUT_PREVIEW_MAX_BYTES_PER_STREAM);
    const stderrPreview = buildHeadTailPreviewText(input.stderr, COMMAND_OUTPUT_PREVIEW_MAX_BYTES_PER_STREAM);
    const totalBytes = stdoutPreview.totalBytes + stderrPreview.totalBytes;
    const totalLines = stdoutPreview.totalLines + stderrPreview.totalLines;
    const omittedBytes = stdoutPreview.omittedBytes + stderrPreview.omittedBytes;

    const rawPayload = {
        command: input.command,
        cwd: input.cwd,
        exitCode: input.exitCode,
        stdout: input.stdout,
        stderr: input.stderr,
        timedOut: input.timedOut,
        durationMs: input.durationMs,
        stdoutBytes: stdoutPreview.totalBytes,
        stderrBytes: stderrPreview.totalBytes,
        totalBytes,
        stdoutLines: stdoutPreview.totalLines,
        stderrLines: stderrPreview.totalLines,
        totalLines,
    };

    return {
        output: {
            command: input.command,
            cwd: input.cwd,
            exitCode: input.exitCode,
            stdout: stdoutPreview.previewText,
            stderr: stderrPreview.previewText,
            stdoutTruncated: stdoutPreview.truncated,
            stderrTruncated: stderrPreview.truncated,
            stdoutBytes: stdoutPreview.totalBytes,
            stderrBytes: stderrPreview.totalBytes,
            totalBytes,
            stdoutLines: stdoutPreview.totalLines,
            stderrLines: stderrPreview.totalLines,
            totalLines,
            omittedBytes,
            timedOut: input.timedOut,
            durationMs: input.durationMs,
        },
        artifactCandidate: {
            kind: 'command_output',
            contentType: 'text/plain',
            rawText: JSON.stringify(rawPayload, null, 2),
            metadata: {
                command: input.command,
                cwd: input.cwd,
                exitCode: input.exitCode,
                timedOut: input.timedOut,
                durationMs: input.durationMs,
                stdoutBytes: stdoutPreview.totalBytes,
                stderrBytes: stderrPreview.totalBytes,
                totalBytes,
                stdoutLines: stdoutPreview.totalLines,
                stderrLines: stderrPreview.totalLines,
                totalLines,
                omittedBytes,
            },
        },
    };
}

export function createReadFileExecutionOutput(
    input: RawReadFileExecution
): { output: ToolExecutionOutput; artifactCandidate: ToolExecutionArtifactCandidate } {
    const requestedPreviewMaxBytes =
        input.requestedPreviewMaxBytes === undefined
            ? input.byteLength
            : Math.max(1, Math.min(Math.floor(input.requestedPreviewMaxBytes), input.byteLength));
    const previewMaxBytes =
        input.byteLength > FILE_READ_ARTIFACT_THRESHOLD_BYTES
            ? Math.min(requestedPreviewMaxBytes, FILE_READ_PREVIEW_MAX_BYTES)
            : requestedPreviewMaxBytes;
    const contentPreview =
        previewMaxBytes < input.byteLength
            ? buildHeadOnlyPreviewText(input.rawText, previewMaxBytes)
            : buildHeadOnlyPreviewText(input.rawText, input.byteLength);

    return {
        output: {
            path: input.path,
            content: contentPreview.previewText,
            byteLength: input.byteLength,
            truncated: contentPreview.truncated,
        },
        artifactCandidate: {
            kind: 'file_read',
            contentType: 'text/plain',
            rawText: input.rawText,
            metadata: {
                path: input.path,
                byteLength: input.byteLength,
                lineCount: contentPreview.totalLines,
                omittedBytes: contentPreview.omittedBytes,
                previewTruncated: contentPreview.truncated,
            },
        },
    };
}

export function createDirectoryListingExecutionOutput(
    input: RawDirectoryListingExecution
): { output: ToolExecutionOutput; artifactCandidate: ToolExecutionArtifactCandidate } {
    const rawText = buildDirectoryListingRawText(input);
    const serializedBytes = Buffer.byteLength(rawText, 'utf8');
    const shouldPreview =
        serializedBytes > DIRECTORY_LISTING_ARTIFACT_THRESHOLD_BYTES ||
        input.count > DIRECTORY_LISTING_ARTIFACT_THRESHOLD_COUNT;
    const previewEntries = shouldPreview ? buildDirectoryListingPreviewEntries(input.entries) : input.entries;
    const previewTruncated = shouldPreview && previewEntries.length < input.entries.length;

    return {
        output: {
            rootPath: input.rootPath,
            entries: previewEntries,
            truncated: input.truncated || previewTruncated,
            count: input.count,
        },
        artifactCandidate: {
            kind: 'directory_listing',
            contentType: 'text/plain',
            rawText,
            metadata: {
                rootPath: input.rootPath,
                count: input.count,
                omittedEntries: previewTruncated ? input.entries.length - previewEntries.length : 0,
                serializedBytes,
                previewTruncated,
            },
        },
    };
}

function getArtifactizedCandidateDetails(
    candidate: ToolExecutionArtifactCandidate | undefined
): ArtifactizedCandidateDetails | null {
    if (!candidate) {
        return null;
    }

    if (candidate.kind === 'command_output') {
        if (candidate.metadata.totalBytes <= COMMAND_OUTPUT_ARTIFACT_THRESHOLD_BYTES) {
            return null;
        }

        return {
            candidate,
            previewStrategy: 'head_tail',
            totalBytes: candidate.metadata.totalBytes,
            totalLines: candidate.metadata.totalLines,
            omittedBytes: candidate.metadata.omittedBytes,
        };
    }

    if (candidate.kind === 'file_read') {
        if (!candidate.metadata.previewTruncated && candidate.metadata.byteLength <= FILE_READ_ARTIFACT_THRESHOLD_BYTES) {
            return null;
        }

        return {
            candidate,
            previewStrategy: 'head_only',
            totalBytes: candidate.metadata.byteLength,
            totalLines: candidate.metadata.lineCount,
            omittedBytes: candidate.metadata.omittedBytes,
        };
    }

    const totalBytes = Buffer.byteLength(candidate.rawText, 'utf8');
    const totalLines = countLines(candidate.rawText);
    if (
        totalBytes <= DIRECTORY_LISTING_ARTIFACT_THRESHOLD_BYTES &&
        candidate.metadata.count <= DIRECTORY_LISTING_ARTIFACT_THRESHOLD_COUNT
    ) {
        return null;
    }

    return {
        candidate,
        previewStrategy: 'bounded_list',
        totalBytes,
        totalLines,
        omittedBytes: 0,
    };
}

export async function prepareToolResultPersistence(input: {
    profileId: string;
    sessionId: string;
    runId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    toolName: string;
    toolOutcome: ToolInvocationOutcome;
}): Promise<PreparedToolResultPersistence> {
    const serializedResult = serializeToolInvocationOutcome(input.toolOutcome);
    const normalizedPayload = serializedResult.ok
        ? createExecutedPayload(serializedResult)
        : createFailedPayload(serializedResult);
    const artifactCandidate = input.toolOutcome.kind === 'executed' ? input.toolOutcome.artifactCandidate : undefined;
    const artifactizedDetails = serializedResult.ok ? getArtifactizedCandidateDetails(artifactCandidate) : null;

    if (!artifactizedDetails) {
        return {
            outputText: JSON.stringify(normalizedPayload, null, 2),
            isError: !serializedResult.ok,
            normalizedPayload,
            payloadArtifactMetadata: {
                artifactized: false,
            },
        };
    }

    const payloadArtifactMetadata: ToolResultArtifactPayloadMetadata = {
        artifactized: true,
        artifactKind: artifactizedDetails.candidate.kind,
        previewStrategy: artifactizedDetails.previewStrategy,
        totalBytes: artifactizedDetails.totalBytes,
        totalLines: artifactizedDetails.totalLines,
        omittedBytes: artifactizedDetails.omittedBytes,
        artifactAvailable: true,
        summaryMode: 'deterministic',
        deterministicPreviewAvailable: true,
    };

    const summaryResult = await artifactSummaryService.summarizeArtifact({
        profileId: input.profileId,
        fallbackProviderId: input.providerId,
        fallbackModelId: input.modelId,
        artifactCandidate: artifactizedDetails.candidate,
    });
    if (summaryResult.kind === 'summary_generated') {
        payloadArtifactMetadata.summaryMode = 'utility_ai';
        payloadArtifactMetadata.summaryProviderId = summaryResult.providerId;
        payloadArtifactMetadata.summaryModelId = summaryResult.modelId;
    }

    if (isRecord(normalizedPayload['output'])) {
        normalizedPayload['output'] = {
            ...normalizedPayload['output'],
            ...payloadArtifactMetadata,
        };
    }

    const deterministicPreviewText = JSON.stringify(normalizedPayload, null, 2);
    const outputText = summaryResult.kind === 'summary_generated' ? summaryResult.summaryText : deterministicPreviewText;

    return {
        outputText,
        isError: false,
        normalizedPayload,
        payloadArtifactMetadata,
        artifactPersistenceCandidate: {
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: input.runId,
            toolName: input.toolName,
            artifactKind: artifactizedDetails.candidate.kind,
            contentType: artifactizedDetails.candidate.contentType,
            rawText: artifactizedDetails.candidate.rawText,
            totalBytes: artifactizedDetails.totalBytes,
            totalLines: artifactizedDetails.totalLines,
            previewText: deterministicPreviewText,
            previewStrategy: artifactizedDetails.previewStrategy,
            metadata: {
                ...artifactizedDetails.candidate.metadata,
                summaryMode: payloadArtifactMetadata.summaryMode,
                ...(payloadArtifactMetadata.summaryProviderId
                    ? { summaryProviderId: payloadArtifactMetadata.summaryProviderId }
                    : {}),
                ...(payloadArtifactMetadata.summaryModelId
                    ? { summaryModelId: payloadArtifactMetadata.summaryModelId }
                    : {}),
                deterministicPreviewAvailable: true,
            },
        },
    };
}
