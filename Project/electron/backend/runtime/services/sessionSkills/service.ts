import { sessionAttachedSkillStore, sessionStore, threadStore } from '@/app/backend/persistence/stores';
import type { SkillfileDefinitionRecord } from '@/app/backend/persistence/types';
import type {
    SessionAttachedSkillsResult,
    SessionGetAttachedSkillsInput,
    SessionSetAttachedSkillsInput,
} from '@/app/backend/runtime/contracts';
import { resolveSkillfilesByAssetKeys } from '@/app/backend/runtime/services/registry/service';

async function resolveSessionWorkspace(input: {
    profileId: string;
    sessionId: SessionGetAttachedSkillsInput['sessionId'];
}): Promise<string | undefined> {
    const sessionStatus = await sessionStore.status(input.profileId, input.sessionId);
    if (!sessionStatus.found) {
        throw new Error(`Session "${input.sessionId}" was not found.`);
    }

    const sessionThread = await threadStore.getBySessionId(input.profileId, input.sessionId);
    if (!sessionThread) {
        throw new Error(`Thread for session "${input.sessionId}" was not found.`);
    }

    return sessionThread.workspaceFingerprint;
}

function mapAttachedSkillsResult(input: {
    sessionId: SessionGetAttachedSkillsInput['sessionId'];
    skillfiles: SkillfileDefinitionRecord[];
    missingAssetKeys: string[];
}): SessionAttachedSkillsResult {
    return {
        sessionId: input.sessionId,
        skillfiles: input.skillfiles,
        ...(input.missingAssetKeys.length > 0 ? { missingAssetKeys: input.missingAssetKeys } : {}),
    };
}

export async function getAttachedSkills(
    input: SessionGetAttachedSkillsInput
): Promise<SessionAttachedSkillsResult> {
    const workspaceFingerprint = await resolveSessionWorkspace(input);
    const attachedSkills = await sessionAttachedSkillStore.listBySession(input.profileId, input.sessionId);
    const resolved = await resolveSkillfilesByAssetKeys({
        profileId: input.profileId,
        assetKeys: attachedSkills.map((skill) => skill.assetKey),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    });

    return mapAttachedSkillsResult({
        sessionId: input.sessionId,
        skillfiles: resolved.skillfiles,
        missingAssetKeys: resolved.missingAssetKeys,
    });
}

export async function setAttachedSkills(
    input: SessionSetAttachedSkillsInput
): Promise<SessionAttachedSkillsResult> {
    const workspaceFingerprint = await resolveSessionWorkspace(input);
    const resolved = await resolveSkillfilesByAssetKeys({
        profileId: input.profileId,
        assetKeys: input.assetKeys,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    });

    if (resolved.missingAssetKeys.length > 0) {
        const label = resolved.missingAssetKeys.length === 1 ? 'skill' : 'skills';
        throw new Error(
            `Cannot attach unresolved ${label}: ${resolved.missingAssetKeys.map((assetKey) => `"${assetKey}"`).join(', ')}.`
        );
    }

    await sessionAttachedSkillStore.replaceForSession({
        profileId: input.profileId,
        sessionId: input.sessionId,
        assetKeys: resolved.skillfiles.map((skillfile) => skillfile.assetKey),
    });

    return mapAttachedSkillsResult({
        sessionId: input.sessionId,
        skillfiles: resolved.skillfiles,
        missingAssetKeys: [],
    });
}
