import { sessionAttachedRuleStore, sessionStore, threadStore } from '@/app/backend/persistence/stores';
import type { RulesetDefinitionRecord } from '@/app/backend/persistence/types';
import type {
    SessionAttachedRulesResult,
    SessionGetAttachedRulesInput,
    SessionSetAttachedRulesInput,
} from '@/app/backend/runtime/contracts';
import { getRegistryPresetKeysForMode } from '@/app/backend/runtime/contracts';
import { resolveRulesetsByAssetKeys } from '@/app/backend/runtime/services/registry/service';
import {
    errSessionRegistry,
    forwardSessionRegistryError,
    missingSessionError,
    missingSessionThreadError,
    okSessionRegistry,
    type SessionRegistryResult,
} from '@/app/backend/runtime/services/sessionSkills/errors';

async function resolveSessionWorkspace(input: {
    profileId: string;
    sessionId: SessionGetAttachedRulesInput['sessionId'];
}): Promise<SessionRegistryResult<string | undefined>> {
    const sessionStatus = await sessionStore.status(input.profileId, input.sessionId);
    if (!sessionStatus.found) {
        return missingSessionError(input.sessionId);
    }

    const sessionThread = await threadStore.getBySessionId(input.profileId, input.sessionId);
    if (!sessionThread) {
        return missingSessionThreadError(input.sessionId);
    }

    return okSessionRegistry(sessionThread.workspaceFingerprint);
}

function mapAttachedRulesResult(input: {
    sessionId: SessionGetAttachedRulesInput['sessionId'];
    topLevelTab: SessionGetAttachedRulesInput['topLevelTab'];
    modeKey: SessionGetAttachedRulesInput['modeKey'];
    rulesets: RulesetDefinitionRecord[];
    missingAssetKeys: string[];
}): SessionAttachedRulesResult {
    const presetKeys = getRegistryPresetKeysForMode({
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
    });

    return {
        sessionId: input.sessionId,
        presetKeys,
        rulesets: input.rulesets,
        ...(input.missingAssetKeys.length > 0 ? { missingAssetKeys: input.missingAssetKeys } : {}),
    };
}

export async function getAttachedRules(
    input: SessionGetAttachedRulesInput
): Promise<SessionRegistryResult<SessionAttachedRulesResult>> {
    const workspaceFingerprintResult = await resolveSessionWorkspace(input);
    if (workspaceFingerprintResult.isErr()) {
        return forwardSessionRegistryError(workspaceFingerprintResult.error);
    }

    const workspaceFingerprint = workspaceFingerprintResult.value;
    const attachedRules = await sessionAttachedRuleStore.listBySession(input.profileId, input.sessionId);
    const resolved = await resolveRulesetsByAssetKeys({
        profileId: input.profileId,
        assetKeys: attachedRules.map((rule) => rule.assetKey),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
    });

    return okSessionRegistry(
        mapAttachedRulesResult({
            sessionId: input.sessionId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            rulesets: resolved.rulesets,
            missingAssetKeys: resolved.missingAssetKeys,
        })
    );
}

export async function setAttachedRules(
    input: SessionSetAttachedRulesInput
): Promise<SessionRegistryResult<SessionAttachedRulesResult>> {
    const workspaceFingerprintResult = await resolveSessionWorkspace(input);
    if (workspaceFingerprintResult.isErr()) {
        return forwardSessionRegistryError(workspaceFingerprintResult.error);
    }

    const workspaceFingerprint = workspaceFingerprintResult.value;
    const resolved = await resolveRulesetsByAssetKeys({
        profileId: input.profileId,
        assetKeys: input.assetKeys,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
    });

    if (resolved.missingAssetKeys.length > 0) {
        const label = resolved.missingAssetKeys.length === 1 ? 'rule' : 'rules';
        return errSessionRegistry(
            'invalid_payload',
            `Cannot attach unresolved ${label}: ${resolved.missingAssetKeys.map((assetKey) => `"${assetKey}"`).join(', ')}.`,
            {
                sessionId: input.sessionId,
                missingAssetKeys: resolved.missingAssetKeys,
            }
        );
    }

    const nonManualRules = resolved.rulesets.filter((ruleset) => ruleset.activationMode !== 'manual');
    if (nonManualRules.length > 0) {
        return errSessionRegistry(
            'invalid_payload',
            `Only manual rules can be attached explicitly. Invalid rules: ${nonManualRules.map((ruleset) => `"${ruleset.assetKey}"`).join(', ')}.`,
            {
                sessionId: input.sessionId,
                invalidAssetKeys: nonManualRules.map((ruleset) => ruleset.assetKey),
            }
        );
    }

    await sessionAttachedRuleStore.replaceForSession({
        profileId: input.profileId,
        sessionId: input.sessionId,
        assetKeys: resolved.rulesets.map((ruleset) => ruleset.assetKey),
    });

    return okSessionRegistry(
        mapAttachedRulesResult({
            sessionId: input.sessionId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            rulesets: resolved.rulesets,
            missingAssetKeys: [],
        })
    );
}
