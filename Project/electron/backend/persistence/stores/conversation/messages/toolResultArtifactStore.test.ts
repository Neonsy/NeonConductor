import { existsSync } from 'node:fs';

import { describe, expect, it, beforeEach } from 'vitest';

import { getDefaultProfileId, getPersistenceStoragePaths, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    conversationStore,
    messageStore,
    runStore,
    sessionStore,
    threadStore,
    toolResultArtifactStore,
} from '@/app/backend/persistence/stores';

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

async function createToolResultPart() {
    const profileId = getDefaultProfileId();
    const conversation = await conversationStore.createOrGetBucket({
        profileId,
        scope: 'detached',
        title: 'Artifact Test',
    });
    if (conversation.isErr()) {
        throw new Error(conversation.error.message);
    }

    const thread = await threadStore.create({
        profileId,
        conversationId: conversation.value.id,
        title: 'Artifact Thread',
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

    const message = await messageStore.createMessage({
        profileId,
        sessionId: session.session.id,
        runId: run.id,
        role: 'tool',
    });
    const part = await messageStore.createPart({
        messageId: message.id,
        partType: 'tool_result',
        payload: {
            callId: 'call_test',
            toolName: 'run_command',
            outputText: 'preview',
            isError: false,
        },
    });

    return {
        profileId,
        sessionId: session.session.id,
        runId: run.id,
        partId: part.id,
    };
}

describe('toolResultArtifactStore', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    it('stores smaller raw payloads inline in the database', async () => {
        const target = await createToolResultPart();
        const record = await toolResultArtifactStore.create({
            messagePartId: target.partId,
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolName: 'run_command',
            artifactKind: 'command_output',
            contentType: 'text/plain',
            rawText: 'small raw payload',
            totalBytes: 17,
            totalLines: 1,
            previewText: 'preview',
            previewStrategy: 'head_tail',
            metadata: {
                command: 'node --version',
            },
        });

        expect(record.storageKind).toBe('text_inline_db');
        expect(await toolResultArtifactStore.getRawText(target.partId)).toBe('small raw payload');
    });

    it('stores larger raw payloads on disk and deletes them during session cleanup', async () => {
        const target = await createToolResultPart();
        const largeRawText = 'x'.repeat(180_000);
        const record = await toolResultArtifactStore.create({
            messagePartId: target.partId,
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolName: 'run_command',
            artifactKind: 'command_output',
            contentType: 'text/plain',
            rawText: largeRawText,
            totalBytes: largeRawText.length,
            totalLines: 1,
            previewText: 'preview',
            previewStrategy: 'head_tail',
            metadata: {
                command: 'node -e "process.stdout.write(\'x\')"',
            },
        });

        expect(record.storageKind).toBe('file_path');
        expect(record.filePath).toBeDefined();
        if (!record.filePath) {
            throw new Error('Expected file-backed artifact path.');
        }
        expect(existsSync(record.filePath)).toBe(true);
        expect(await toolResultArtifactStore.getRawText(target.partId)).toBe(largeRawText);

        await toolResultArtifactStore.deleteBySessionIds([target.sessionId]);

        expect(await toolResultArtifactStore.getByMessagePartId(target.partId)).toBeNull();
        expect(await toolResultArtifactStore.getRawText(target.partId)).toBeNull();
        expect(existsSync(record.filePath)).toBe(false);
        expect(getPersistenceStoragePaths().toolArtifactsRoot.length).toBeGreaterThan(0);
    });

    it('persists and reads all supported artifact kinds', async () => {
        const target = await createToolResultPart();
        const fileArtifact = await toolResultArtifactStore.create({
            messagePartId: target.partId,
            profileId: target.profileId,
            sessionId: target.sessionId,
            runId: target.runId,
            toolName: 'read_file',
            artifactKind: 'file_read',
            contentType: 'text/plain',
            rawText: 'file body',
            totalBytes: 9,
            totalLines: 1,
            previewText: 'file preview',
            previewStrategy: 'head_only',
            metadata: {
                path: 'C:/workspace/README.md',
            },
        });

        expect(fileArtifact.artifactKind).toBe('file_read');
        expect(fileArtifact.previewStrategy).toBe('head_only');
        expect(await toolResultArtifactStore.getRawText(target.partId)).toBe('file body');

        const listingTarget = await createToolResultPart();
        const listingArtifact = await toolResultArtifactStore.create({
            messagePartId: listingTarget.partId,
            profileId: listingTarget.profileId,
            sessionId: listingTarget.sessionId,
            runId: listingTarget.runId,
            toolName: 'list_files',
            artifactKind: 'directory_listing',
            contentType: 'text/plain',
            rawText: '{"entries":[{"path":"a.ts","kind":"file"}]}',
            totalBytes: 40,
            totalLines: 1,
            previewText: 'listing preview',
            previewStrategy: 'bounded_list',
            metadata: {
                rootPath: 'C:/workspace',
                count: 1,
            },
        });

        expect(listingArtifact.artifactKind).toBe('directory_listing');
        expect(listingArtifact.previewStrategy).toBe('bounded_list');
        expect(await toolResultArtifactStore.getRawText(listingTarget.partId)).toContain('"entries"');
    });
});
