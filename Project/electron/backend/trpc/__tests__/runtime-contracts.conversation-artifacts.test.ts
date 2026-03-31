import { describe, expect, it } from 'vitest';

import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';
import { messageStore, runStore, toolResultArtifactStore } from '@/app/backend/persistence/stores';

registerRuntimeContractHooks();

async function createArtifactFixture(input?: { profileId?: string; rawText?: string }) {
    const caller = createCaller();
    const profileId = input?.profileId ?? runtimeContractProfileId;
    const created = await createSessionInScope(caller, profileId, {
        scope: 'detached',
        title: 'Artifact retrieval fixture',
        kind: 'local',
    });
    const rawText =
        input?.rawText ??
        Array.from({ length: 450 }, (_, index) =>
            index >= 320 && index < 430 ? `match line ${String(index + 1)}` : `plain line ${String(index + 1)}`
        ).join('\n');

    const run = await runStore.create({
        profileId,
        sessionId: created.session.id,
        prompt: 'artifact fixture',
        providerId: 'openai',
        modelId: 'openai/gpt-5',
        authMethod: 'api_key',
        runtimeOptions: defaultRuntimeOptions,
        cache: {
            applied: false,
        },
        transport: {},
    });
    const message = await messageStore.createMessage({
        profileId,
        sessionId: created.session.id,
        runId: run.id,
        role: 'tool',
    });
    const part = await messageStore.createPart({
        messageId: message.id,
        partType: 'tool_result',
        payload: {
            callId: 'call_fixture',
            toolName: 'run_command',
            outputText: 'preview',
            isError: false,
            artifactized: true,
            artifactAvailable: true,
            artifactKind: 'command_output',
            previewStrategy: 'head_tail',
            totalBytes: Buffer.byteLength(rawText, 'utf8'),
            totalLines: 450,
            omittedBytes: 1024,
        },
    });

    await toolResultArtifactStore.create({
        messagePartId: part.id,
        profileId,
        sessionId: created.session.id,
        runId: run.id,
        toolName: 'run_command',
        artifactKind: 'command_output',
        contentType: 'text/plain',
        rawText,
        totalBytes: Buffer.byteLength(rawText, 'utf8'),
        totalLines: 450,
        previewText: 'preview',
        previewStrategy: 'head_tail',
        metadata: {
            command: 'dir /s',
        },
    });

    return {
        caller,
        profileId,
        sessionId: created.session.id,
        messagePartId: part.id,
    };
}

describe('runtime contracts: conversation artifact retrieval', () => {
    it('reads a paged tool artifact window for an owned artifactized tool result', async () => {
        const fixture = await createArtifactFixture();

        const result = await fixture.caller.conversation.readToolArtifact({
            profileId: fixture.profileId,
            sessionId: fixture.sessionId,
            messagePartId: fixture.messagePartId,
        });

        expect(result.found).toBe(true);
        if (!result.found) {
            throw new Error('Expected stored artifact to be readable.');
        }

        expect(result.artifact.startLine).toBe(1);
        expect(result.artifact.lineCount).toBe(400);
        expect(result.artifact.lines).toHaveLength(400);
        expect(result.artifact.hasPrevious).toBe(false);
        expect(result.artifact.hasNext).toBe(true);
    });

    it('fails closed when the caller supplies the wrong session, wrong profile, or a missing artifact', async () => {
        const fixture = await createArtifactFixture();

        const wrongSessionResult = await fixture.caller.conversation.readToolArtifact({
            profileId: fixture.profileId,
            sessionId: 'sess_wrong' as typeof fixture.sessionId,
            messagePartId: fixture.messagePartId,
        });
        expect(wrongSessionResult).toEqual({ found: false });

        const wrongProfileResult = await fixture.caller.conversation.readToolArtifact({
            profileId: 'profile_other',
            sessionId: fixture.sessionId,
            messagePartId: fixture.messagePartId,
        });
        expect(wrongProfileResult).toEqual({ found: false });

        const missingArtifactResult = await fixture.caller.conversation.readToolArtifact({
            profileId: fixture.profileId,
            sessionId: fixture.sessionId,
            messagePartId: 'part_missing' as typeof fixture.messagePartId,
        });
        expect(missingArtifactResult).toEqual({ found: false });
    });

    it('searches tool artifacts with bounded substring matches', async () => {
        const fixture = await createArtifactFixture();

        const searchResult = await fixture.caller.conversation.searchToolArtifact({
            profileId: fixture.profileId,
            sessionId: fixture.sessionId,
            messagePartId: fixture.messagePartId,
            query: 'match line',
        });

        expect(searchResult.found).toBe(true);
        expect(searchResult.matches).toHaveLength(100);
        expect(searchResult.truncated).toBe(true);
        expect(searchResult.matches[0]).toMatchObject({
            lineNumber: 321,
        });
    });

    it('fails closed when search callers do not own the artifact', async () => {
        const fixture = await createArtifactFixture();

        const wrongSessionResult = await fixture.caller.conversation.searchToolArtifact({
            profileId: fixture.profileId,
            sessionId: 'sess_wrong' as typeof fixture.sessionId,
            messagePartId: fixture.messagePartId,
            query: 'match line',
        });
        expect(wrongSessionResult).toEqual({
            found: false,
            matches: [],
            truncated: false,
        });

        const wrongProfileResult = await fixture.caller.conversation.searchToolArtifact({
            profileId: 'profile_other',
            sessionId: fixture.sessionId,
            messagePartId: fixture.messagePartId,
            query: 'match line',
        });
        expect(wrongProfileResult).toEqual({
            found: false,
            matches: [],
            truncated: false,
        });
    });
});
