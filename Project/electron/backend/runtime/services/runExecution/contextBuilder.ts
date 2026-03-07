import { createHash } from 'node:crypto';

import { messageStore, sessionAttachedSkillStore } from '@/app/backend/persistence/stores';
import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';
import type { ModeDefinition, RulesetDefinition, SkillfileDefinition, TopLevelTab } from '@/app/backend/runtime/contracts';
import { listResolvedRegistry, resolveSkillfilesByAssetKeys } from '@/app/backend/runtime/services/registry/service';
import {
    errRunExecution,
    okRunExecution,
    type RunExecutionResult,
} from '@/app/backend/runtime/services/runExecution/errors';
import type { RunContext, RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';

const MAX_CONTEXT_MESSAGES = 40;
const MAX_CONTEXT_CHARS = 120_000;

function toPartsMap(parts: MessagePartRecord[]): Map<string, MessagePartRecord[]> {
    const map = new Map<string, MessagePartRecord[]>();
    for (const part of parts) {
        const existing = map.get(part.messageId) ?? [];
        existing.push(part);
        map.set(part.messageId, existing);
    }
    return map;
}

function mapRole(role: MessageRecord['role']): RunContextMessage['role'] | null {
    if (role === 'user') {
        return 'user';
    }
    if (role === 'assistant') {
        return 'assistant';
    }
    if (role === 'system') {
        return 'system';
    }
    return null;
}

function extractText(parts: MessagePartRecord[]): string {
    const segments: string[] = [];
    for (const part of parts) {
        const text = part.payload['text'];
        if (typeof text !== 'string') {
            continue;
        }
        const normalized = text.trim();
        if (normalized.length === 0) {
            continue;
        }
        segments.push(normalized);
    }

    return segments.join('\n\n').trim();
}

function buildDigest(messages: RunContextMessage[]): string {
    const hash = createHash('sha256');
    for (const message of messages) {
        hash.update(message.role);
        hash.update('|');
        hash.update(message.text);
        hash.update('\n');
    }
    return `runctx-${hash.digest('hex').slice(0, 32)}`;
}

function trimReplayMessages(messages: RunContextMessage[]): RunContextMessage[] {
    if (messages.length <= MAX_CONTEXT_MESSAGES) {
        const totalChars = messages.reduce((sum, message) => sum + message.text.length, 0);
        if (totalChars <= MAX_CONTEXT_CHARS) {
            return messages;
        }
    }

    const trimmed: RunContextMessage[] = [];
    let runningChars = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message) {
            continue;
        }
        if (trimmed.length >= MAX_CONTEXT_MESSAGES) {
            break;
        }

        const nextChars = runningChars + message.text.length;
        if (nextChars > MAX_CONTEXT_CHARS && trimmed.length > 0) {
            break;
        }

        trimmed.push(message);
        runningChars = nextChars;
    }

    return trimmed.reverse();
}

function buildReplayMessages(input: {
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
    prompt: string;
}): RunContextMessage[] {
    const replay: RunContextMessage[] = [];
    for (const message of input.messages) {
        const role = mapRole(message.role);
        if (!role) {
            continue;
        }
        const text = extractText(input.partsByMessageId.get(message.id) ?? []);
        if (!text) {
            continue;
        }
        replay.push({ role, text });
    }

    replay.push({
        role: 'user',
        text: input.prompt.trim(),
    });

    return trimReplayMessages(replay);
}

function readModeInstructions(mode: ModeDefinition): string | undefined {
    const instructions = mode.prompt['instructionsMarkdown'];
    return typeof instructions === 'string' && instructions.trim().length > 0 ? instructions.trim() : undefined;
}

function createSystemMessage(label: string, body: string): RunContextMessage {
    return {
        role: 'system',
        text: `${label}\n\n${body.trim()}`,
    };
}

function buildAgentPrelude(input: {
    mode: ModeDefinition;
    rulesets: RulesetDefinition[];
    skillfiles: SkillfileDefinition[];
}): RunContextMessage[] {
    const prelude: RunContextMessage[] = [];
    const modeInstructions = readModeInstructions(input.mode);
    if (modeInstructions) {
        prelude.push(createSystemMessage(`Active mode: ${input.mode.label}`, modeInstructions));
    }

    for (const ruleset of input.rulesets) {
        prelude.push(createSystemMessage(`Ruleset: ${ruleset.name}`, ruleset.bodyMarkdown));
    }

    for (const skillfile of input.skillfiles) {
        prelude.push(createSystemMessage(`Attached skill: ${skillfile.name}`, skillfile.bodyMarkdown));
    }

    return prelude;
}

export async function buildRunContext(input: {
    profileId: string;
    sessionId: `sess_${string}`;
    prompt: string;
    topLevelTab: TopLevelTab;
    workspaceFingerprint?: string;
    resolvedMode: {
        mode: ModeDefinition;
    };
}): Promise<RunExecutionResult<RunContext | undefined>> {
    if (input.topLevelTab === 'orchestrator') {
        return okRunExecution(undefined);
    }

    const [messages, parts] = await Promise.all([
        messageStore.listMessagesBySession(input.profileId, input.sessionId),
        messageStore.listPartsBySession(input.profileId, input.sessionId),
    ]);
    const replayMessages = buildReplayMessages({
        messages,
        partsByMessageId: toPartsMap(parts),
        prompt: input.prompt,
    });

    if (input.topLevelTab === 'chat') {
        return okRunExecution({
            messages: replayMessages,
            digest: buildDigest(replayMessages),
        });
    }

    const [resolvedRegistry, attachedSkillRows] = await Promise.all([
        listResolvedRegistry({
            profileId: input.profileId,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        }),
        sessionAttachedSkillStore.listBySession(input.profileId, input.sessionId),
    ]);
    const resolvedSkills = await resolveSkillfilesByAssetKeys({
        profileId: input.profileId,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        assetKeys: attachedSkillRows.map((skill) => skill.assetKey),
    });

    if (resolvedSkills.missingAssetKeys.length > 0) {
        const missingList = resolvedSkills.missingAssetKeys.map((assetKey) => `"${assetKey}"`).join(', ');
        return errRunExecution(
            'invalid_payload',
            `Session references unresolved attached skills: ${missingList}. Refresh the registry or update attached skills.`
        );
    }

    const prelude = buildAgentPrelude({
        mode: input.resolvedMode.mode,
        rulesets: resolvedRegistry.resolved.rulesets,
        skillfiles: resolvedSkills.skillfiles,
    });
    const assembledMessages = [...prelude, ...replayMessages];

    return okRunExecution({
        messages: assembledMessages,
        digest: buildDigest(assembledMessages),
    });
}
