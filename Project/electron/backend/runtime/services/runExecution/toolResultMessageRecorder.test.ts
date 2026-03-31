import { beforeEach, describe, expect, it } from 'vitest';

import { getDefaultProfileId, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    conversationStore,
    messageStore,
    runStore,
    sessionStore,
    threadStore,
    toolResultArtifactStore,
} from '@/app/backend/persistence/stores';
import { buildReplayMessages, toPartsMap } from '@/app/backend/runtime/services/runExecution/contextReplay';
import { extractTextFromParts } from '@/app/backend/runtime/services/runExecution/contextParts';
import { persistToolResultMessage } from '@/app/backend/runtime/services/runExecution/toolResultMessageRecorder';
import {
    createDirectoryListingExecutionOutput,
    createReadFileExecutionOutput,
    createRunCommandExecutionOutput,
} from '@/app/backend/runtime/services/toolExecution/toolOutputCompressionPolicy';

const runtimeOptions = {
    reasoning: {
        effort: 'medium' as const,
        summary: 'auto' as const,
        includeEncrypted: true,
    },
    cache: {
        strategy: 'auto' as const,
    },
    transport: {
        family: 'auto' as const,
    },
};

async function createSessionRun() {
    const profileId = getDefaultProfileId();
    const conversation = await conversationStore.createOrGetBucket({
        profileId,
        scope: 'detached',
        title: 'Recorder Test',
    });
    if (conversation.isErr()) {
        throw new Error(conversation.error.message);
    }

    const thread = await threadStore.create({
        profileId,
        conversationId: conversation.value.id,
        title: 'Recorder Thread',
        topLevelTab: 'chat',
    });
    if (thread.isErr()) {
        throw new Error(thread.error.message);
    }

    const session = await sessionStore.create(profileId, thread.value.id, 'local');
    if (!session.created) {
        throw new Error(session.reason);
    }

    const run = await runStore.create({
        profileId,
        sessionId: session.session.id,
        prompt: 'test',
        providerId: 'openai',
        modelId: 'openai/gpt-5',
        authMethod: 'api_key',
        runtimeOptions,
        cache: {
            applied: false,
        },
        transport: {},
    });

    return {
        profileId,
        sessionId: session.session.id,
        runId: run.id,
    };
}

describe('toolResultMessageRecorder', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    it('persists only the preview in message history while preserving raw command output in an artifact row', async () => {
        const target = await createSessionRun();
        const oversizedStdout = 'x'.repeat(80_000);
        const execution = createRunCommandExecutionOutput({
            command: 'node -e "process.stdout.write(\'x\')"',
            cwd: 'C:/workspace',
            exitCode: 0,
            stdout: oversizedStdout,
            stderr: '',
            timedOut: false,
            durationMs: 12,
        });

        const context = await persistToolResultMessage({
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolCall: {
                callId: 'call_shell',
                toolName: 'run_command',
                argumentsText: '{"command":"node -e \\"process.stdout.write(\\\\\'x\\\\\')\\""}',
                args: {
                    command: 'node -e "process.stdout.write(\'x\')"',
                },
            },
            toolOutcome: {
                kind: 'executed',
                toolId: 'run_command',
                output: execution.output,
                artifactCandidate: execution.artifactCandidate,
                at: '2026-03-31T12:00:00.000Z',
                policy: {
                    effective: 'allow',
                    source: 'test',
                },
            },
        });

        const messageParts = await messageStore.listPartsBySession(target.profileId, target.sessionId);
        const toolResultPart = messageParts.find((part) => part.partType === 'tool_result');
        if (!toolResultPart) {
            throw new Error('Expected persisted tool_result part.');
        }

        const outputText = String(toolResultPart.payload['outputText']);
        expect(outputText).toBe(context.outputText);
        expect(outputText.length).toBeLessThan(oversizedStdout.length);
        expect(outputText).toContain('"artifactized": true');
        expect(outputText).not.toContain(oversizedStdout);

        const resultPayload = toolResultPart.payload['result'];
        expect(JSON.stringify(resultPayload)).not.toContain(oversizedStdout);

        const artifact = await toolResultArtifactStore.getByMessagePartId(toolResultPart.id);
        expect(artifact?.artifactKind).toBe('command_output');
        expect(await toolResultArtifactStore.getRawText(toolResultPart.id)).toContain(oversizedStdout);

        const replayMessages = buildReplayMessages({
            messages: await messageStore.listMessagesBySession(target.profileId, target.sessionId),
            partsByMessageId: toPartsMap(messageParts),
        });
        const replayToolMessage = replayMessages.find((message) => message.role === 'tool');
        if (!replayToolMessage) {
            throw new Error('Expected replay tool message.');
        }

        expect(extractTextFromParts(replayToolMessage.parts)).toBe(outputText);
    });

    it('persists only preview text for oversized file reads and directory listings during replay', async () => {
        const target = await createSessionRun();
        const fileRawText = `header\n${'x'.repeat(40_000)}`;
        const fileExecution = createReadFileExecutionOutput({
            path: 'C:/workspace/big.log',
            rawText: fileRawText,
            byteLength: Buffer.byteLength(fileRawText, 'utf8'),
        });

        await persistToolResultMessage({
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolCall: {
                callId: 'call_read_file',
                toolName: 'read_file',
                argumentsText: '{"path":"big.log"}',
                args: {
                    path: 'big.log',
                },
            },
            toolOutcome: {
                kind: 'executed',
                toolId: 'read_file',
                output: fileExecution.output,
                artifactCandidate: fileExecution.artifactCandidate,
                at: '2026-03-31T12:00:00.000Z',
                policy: {
                    effective: 'allow',
                    source: 'test',
                },
            },
        });

        const listingEntries = Array.from({ length: 260 }, (_, index) => ({
            path: `C:/workspace/src/file-${index}.ts`,
            kind: 'file' as const,
        }));
        const listingExecution = createDirectoryListingExecutionOutput({
            rootPath: 'C:/workspace',
            entries: listingEntries,
            truncated: true,
            count: listingEntries.length,
        });

        await persistToolResultMessage({
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolCall: {
                callId: 'call_list_files',
                toolName: 'list_files',
                argumentsText: '{"path":"src","recursive":true}',
                args: {
                    path: 'src',
                    recursive: true,
                },
            },
            toolOutcome: {
                kind: 'executed',
                toolId: 'list_files',
                output: listingExecution.output,
                artifactCandidate: listingExecution.artifactCandidate,
                at: '2026-03-31T12:00:01.000Z',
                policy: {
                    effective: 'allow',
                    source: 'test',
                },
            },
        });

        const messageParts = await messageStore.listPartsBySession(target.profileId, target.sessionId);
        const fileResultPart = messageParts.find(
            (part) => part.partType === 'tool_result' && part.payload['toolName'] === 'read_file'
        );
        const listingResultPart = messageParts.find(
            (part) => part.partType === 'tool_result' && part.payload['toolName'] === 'list_files'
        );
        if (!fileResultPart || !listingResultPart) {
            throw new Error('Expected read_file and list_files tool_result parts.');
        }

        expect(String(fileResultPart.payload['outputText'])).not.toContain(fileRawText);
        expect(String(fileResultPart.payload['outputText'])).toContain('"artifactKind": "file_read"');
        expect(String(listingResultPart.payload['outputText'])).not.toContain('file-259.ts');
        expect(String(listingResultPart.payload['outputText'])).toContain('file-49.ts');
        expect(String(listingResultPart.payload['outputText'])).toContain('"artifactKind": "directory_listing"');

        const fileArtifact = await toolResultArtifactStore.getByMessagePartId(fileResultPart.id);
        const listingArtifact = await toolResultArtifactStore.getByMessagePartId(listingResultPart.id);
        expect(fileArtifact?.artifactKind).toBe('file_read');
        expect(listingArtifact?.artifactKind).toBe('directory_listing');
        expect(await toolResultArtifactStore.getRawText(fileResultPart.id)).toBe(fileRawText);
        expect(await toolResultArtifactStore.getRawText(listingResultPart.id)).toContain('file-259.ts');

        const replayMessages = buildReplayMessages({
            messages: await messageStore.listMessagesBySession(target.profileId, target.sessionId),
            partsByMessageId: toPartsMap(messageParts),
        });
        const replayToolMessages = replayMessages.filter((message) => message.role === 'tool');
        expect(replayToolMessages).toHaveLength(2);
        expect(extractTextFromParts(replayToolMessages[0]?.parts ?? [])).toBe(String(fileResultPart.payload['outputText']));
        expect(extractTextFromParts(replayToolMessages[1]?.parts ?? [])).toBe(
            String(listingResultPart.payload['outputText'])
        );
    });
});
