import { describe, expect, it } from 'vitest';

import {
    createDirectoryListingExecutionOutput,
    createReadFileExecutionOutput,
    createRunCommandExecutionOutput,
    prepareToolResultPersistence,
} from '@/app/backend/runtime/services/toolExecution/toolOutputCompressionPolicy';
import type {
    ToolExecutionArtifactCandidate,
    ToolInvocationOutcome,
    ToolOutputEntry,
} from '@/app/backend/runtime/services/toolExecution/types';

function createExecutedOutcome(input: {
    toolId: string;
    output: Record<string, unknown>;
    artifactCandidate?: ToolExecutionArtifactCandidate;
}): ToolInvocationOutcome {
    return {
        kind: 'executed',
        toolId: input.toolId,
        output: input.output,
        ...(input.artifactCandidate ? { artifactCandidate: input.artifactCandidate } : {}),
        at: '2026-03-31T12:00:00.000Z',
        policy: {
            effective: 'allow',
            source: 'test',
        },
    };
}

function createDirectoryEntries(count: number): ToolOutputEntry[] {
    return Array.from({ length: count }, (_, index) => ({
        path: `C:/workspace/src/file-${index}.ts`,
        kind: 'file',
    }));
}

describe('toolOutputCompressionPolicy', () => {
    it('keeps small command output inline without an artifact row candidate', () => {
        const execution = createRunCommandExecutionOutput({
            command: 'node -e "process.stdout.write(\'x\')"',
            cwd: 'C:/workspace',
            exitCode: 0,
            stdout: 'small output',
            stderr: '',
            timedOut: false,
            durationMs: 42,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'run_command',
            toolOutcome: createExecutedOutcome({
                toolId: 'run_command',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(prepared.payloadArtifactMetadata.artifactized).toBe(false);
        expect(prepared.artifactPersistenceCandidate).toBeUndefined();
        expect(prepared.outputText).toContain('small output');
    });

    it('artifactizes oversized command output while preserving only the preview in the result payload', () => {
        const oversizedOutput = 'x'.repeat(60_000);
        const execution = createRunCommandExecutionOutput({
            command: 'node -e "process.stdout.write(\'x\')"',
            cwd: 'C:/workspace',
            exitCode: 0,
            stdout: oversizedOutput,
            stderr: '',
            timedOut: false,
            durationMs: 42,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'run_command',
            toolOutcome: createExecutedOutcome({
                toolId: 'run_command',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(prepared.payloadArtifactMetadata.artifactized).toBe(true);
        expect(prepared.payloadArtifactMetadata.artifactKind).toBe('command_output');
        expect(prepared.payloadArtifactMetadata.previewStrategy).toBe('head_tail');
        expect(prepared.payloadArtifactMetadata.totalBytes).toBe(60_000);
        expect(prepared.artifactPersistenceCandidate?.rawText).toContain(oversizedOutput);
        expect(prepared.outputText.length).toBeLessThan(oversizedOutput.length);
        expect(prepared.outputText).toContain('"artifactized": true');

        const output = prepared.normalizedPayload['output'];
        expect(typeof output).toBe('object');
        expect(JSON.stringify(output)).not.toContain(oversizedOutput);
    });

    it('builds head-tail previews for large command streams', () => {
        const execution = createRunCommandExecutionOutput({
            command: 'node -e "process.stdout.write(\'x\')"',
            cwd: 'C:/workspace',
            exitCode: 0,
            stdout: `${'a'.repeat(10_000)}${'b'.repeat(10_000)}`,
            stderr: '',
            timedOut: false,
            durationMs: 10,
        });

        expect(String(execution.output['stdoutTruncated'])).toBe('true');
        expect(String(execution.output['stdout'])).toContain('bytes omitted');
        expect(String(execution.output['stdout']).startsWith('aaaa')).toBe(true);
        expect(String(execution.output['stdout']).endsWith('bbbb')).toBe(true);
    });

    it('keeps small file reads inline without artifactization', () => {
        const execution = createReadFileExecutionOutput({
            path: 'C:/workspace/README.md',
            rawText: 'short file body',
            byteLength: 15,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'read_file',
            toolOutcome: createExecutedOutcome({
                toolId: 'read_file',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(execution.output['content']).toBe('short file body');
        expect(execution.output['truncated']).toBe(false);
        expect(prepared.payloadArtifactMetadata.artifactized).toBe(false);
        expect(prepared.artifactPersistenceCandidate).toBeUndefined();
    });

    it('artifactizes oversized file reads and stores only the preview in the persisted result payload', () => {
        const rawText = `header\n${'x'.repeat(40_000)}`;
        const execution = createReadFileExecutionOutput({
            path: 'C:/workspace/big.log',
            rawText,
            byteLength: Buffer.byteLength(rawText, 'utf8'),
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'read_file',
            toolOutcome: createExecutedOutcome({
                toolId: 'read_file',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(prepared.payloadArtifactMetadata.artifactized).toBe(true);
        expect(prepared.payloadArtifactMetadata.artifactKind).toBe('file_read');
        expect(prepared.payloadArtifactMetadata.previewStrategy).toBe('head_only');
        expect(String(execution.output['content'])).not.toBe(rawText);
        expect(String(execution.output['content'])).toContain('bytes omitted');
        expect(prepared.artifactPersistenceCandidate?.rawText).toBe(rawText);
        expect(JSON.stringify(prepared.normalizedPayload['output'])).not.toContain(rawText);
    });

    it('artifactizes caller-truncated file previews so raw content is not lost', () => {
        const rawText = 'abcdefghijklmnopqrstuvwxyz';
        const execution = createReadFileExecutionOutput({
            path: 'C:/workspace/notes.txt',
            rawText,
            byteLength: Buffer.byteLength(rawText, 'utf8'),
            requestedPreviewMaxBytes: 5,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'read_file',
            toolOutcome: createExecutedOutcome({
                toolId: 'read_file',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(prepared.payloadArtifactMetadata.artifactized).toBe(true);
        expect(prepared.payloadArtifactMetadata.artifactKind).toBe('file_read');
        expect(prepared.artifactPersistenceCandidate?.rawText).toBe(rawText);
        expect(String(execution.output['content'])).toContain('bytes omitted');
    });

    it('keeps small directory listings inline', () => {
        const execution = createDirectoryListingExecutionOutput({
            rootPath: 'C:/workspace',
            entries: createDirectoryEntries(5),
            truncated: false,
            count: 5,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'list_files',
            toolOutcome: createExecutedOutcome({
                toolId: 'list_files',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect((execution.output['entries'] as ToolOutputEntry[])).toHaveLength(5);
        expect(prepared.payloadArtifactMetadata.artifactized).toBe(false);
    });

    it('artifactizes oversized directory listings and persists only a bounded preview', () => {
        const entries = createDirectoryEntries(260);
        const execution = createDirectoryListingExecutionOutput({
            rootPath: 'C:/workspace',
            entries,
            truncated: true,
            count: entries.length,
        });

        const prepared = prepareToolResultPersistence({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            runId: 'run_test',
            toolName: 'list_files',
            toolOutcome: createExecutedOutcome({
                toolId: 'list_files',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
            }),
        });

        expect(prepared.payloadArtifactMetadata.artifactized).toBe(true);
        expect(prepared.payloadArtifactMetadata.artifactKind).toBe('directory_listing');
        expect(prepared.payloadArtifactMetadata.previewStrategy).toBe('bounded_list');
        expect((execution.output['entries'] as ToolOutputEntry[])).toHaveLength(50);
        expect(prepared.artifactPersistenceCandidate?.rawText).toContain('"entries"');
        expect(prepared.artifactPersistenceCandidate?.rawText).toContain('file-259.ts');
        expect(JSON.stringify(prepared.normalizedPayload['output'])).not.toContain('file-259.ts');
        expect(JSON.stringify(prepared.normalizedPayload['output'])).toContain('file-49.ts');
    });
});
