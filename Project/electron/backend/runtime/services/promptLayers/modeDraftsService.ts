import path from 'node:path';

import { modeDraftStore } from '@/app/backend/persistence/stores';
import type {
    ModeDraftRecord,
    PromptLayerApplyModeDraftInput,
    PromptLayerCreateModeDraftInput,
    PromptLayerImportCustomModeInput,
    PromptLayerModeDraftPayload,
    PromptLayerSettings,
    PromptLayerUpdateModeDraftInput,
    PromptLayerValidateModeDraftInput,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import {
    buildCanonicalCustomModePayload,
    fileExists,
    parsePortableCustomModeJson,
    renderCanonicalModeMarkdown,
    resolveCustomModeDirectory,
    toDraftModePayloadFromPortableImport,
    writePortableModeFile,
    type CanonicalCustomModePayload,
} from '@/app/backend/runtime/services/promptLayers/customModePortability';
import { getPromptLayerSettings } from '@/app/backend/runtime/services/promptLayers/settingsService';
import { findFileBackedCustomMode, refreshDiscoveredModesForScope } from '@/app/backend/runtime/services/promptLayers/shared';

import { getModeRoleTemplateDefinition } from '@/shared/modeRoleCatalog';

interface ModeDraftValidationResult {
    validationState: ModeDraftRecord['validationState'];
    validationErrors: string[];
    canonicalPayload?: CanonicalCustomModePayload;
}

function validateDraftPayload(input: PromptLayerModeDraftPayload): ModeDraftValidationResult {
    const validationErrors: string[] = [];
    const slug = input.slug?.trim();
    const name = input.name?.trim();
    const authoringRole = input.authoringRole;
    const roleTemplate = input.roleTemplate;

    if (!slug) {
        validationErrors.push('Slug is required.');
    }
    if (!name) {
        validationErrors.push('Name is required.');
    }
    if (!authoringRole) {
        validationErrors.push('Authoring role is required.');
    }
    if (!roleTemplate) {
        validationErrors.push('Role template is required.');
    }

    if (authoringRole && roleTemplate) {
        try {
            const template = getModeRoleTemplateDefinition(roleTemplate);
            if (template.authoringRole !== authoringRole) {
                validationErrors.push('Role template must match the selected authoring role.');
            }
        } catch (error) {
            validationErrors.push((error as Error).message);
        }
    }

    if (validationErrors.length > 0) {
        return {
            validationState: 'invalid',
            validationErrors,
        };
    }

    try {
        const canonicalPayload = buildCanonicalCustomModePayload({
            slug: slug ?? '',
            name: name ?? '',
            authoringRole: authoringRole ?? 'single_task_agent',
            roleTemplate: roleTemplate ?? 'single_task_agent/apply',
            ...(input.description ? { description: input.description } : {}),
            ...(input.roleDefinition ? { roleDefinition: input.roleDefinition } : {}),
            ...(input.customInstructions ? { customInstructions: input.customInstructions } : {}),
            ...(input.whenToUse ? { whenToUse: input.whenToUse } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
        });

        return {
            validationState: 'valid',
            validationErrors: [],
            canonicalPayload,
        };
    } catch (error) {
        return {
            validationState: 'invalid',
            validationErrors: [(error as Error).message],
        };
    }
}

function withPastedSourceMaterial(input: PromptLayerCreateModeDraftInput): PromptLayerModeDraftPayload {
    if (input.sourceKind !== 'pasted_source_material' || !input.sourceText || input.mode.customInstructions) {
        return input.mode;
    }

    return {
        ...input.mode,
        customInstructions: input.sourceText,
    };
}

async function persistModeDraft(input: {
    profileId: string;
    draftId?: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    sourceKind: ModeDraftRecord['sourceKind'];
    sourceText?: string;
    mode: PromptLayerModeDraftPayload;
    createdAt?: string;
}): Promise<ModeDraftRecord> {
    const validation = validateDraftPayload(input.mode);
    return modeDraftStore.upsert({
        profileId: input.profileId,
        ...(input.draftId ? { draftId: input.draftId } : {}),
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        sourceKind: input.sourceKind,
        ...(input.sourceText ? { sourceText: input.sourceText } : {}),
        mode: input.mode,
        validationState: validation.validationState,
        validationErrors: validation.validationErrors,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    });
}

export async function createModeDraft(
    input: PromptLayerCreateModeDraftInput
): Promise<OperationalResult<{ draft: ModeDraftRecord; settings: PromptLayerSettings }>> {
    const draft = await persistModeDraft({
        ...input,
        mode: withPastedSourceMaterial(input),
    });

    return okOp({
        draft,
        settings: await getPromptLayerSettings(input.profileId, input.workspaceFingerprint),
    });
}

export async function updateModeDraft(
    input: PromptLayerUpdateModeDraftInput
): Promise<OperationalResult<{ draft: ModeDraftRecord; settings: PromptLayerSettings }>> {
    const existingDraft = await modeDraftStore.getById(input.profileId, input.draftId);
    if (!existingDraft) {
        return errOp('not_found', `Mode draft "${input.draftId}" was not found.`);
    }

    const draft = await persistModeDraft({
        profileId: input.profileId,
        draftId: existingDraft.id,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
        sourceKind: existingDraft.sourceKind,
        ...(input.sourceText ?? existingDraft.sourceText
            ? { sourceText: input.sourceText ?? existingDraft.sourceText }
            : {}),
        mode: input.mode,
        createdAt: existingDraft.createdAt,
    });

    return okOp({
        draft,
        settings: await getPromptLayerSettings(input.profileId, existingDraft.workspaceFingerprint),
    });
}

export async function validateModeDraft(
    input: PromptLayerValidateModeDraftInput
): Promise<OperationalResult<{ draft: ModeDraftRecord; settings: PromptLayerSettings }>> {
    const existingDraft = await modeDraftStore.getById(input.profileId, input.draftId);
    if (!existingDraft) {
        return errOp('not_found', `Mode draft "${input.draftId}" was not found.`);
    }

    const draft = await persistModeDraft({
        profileId: input.profileId,
        draftId: existingDraft.id,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
        sourceKind: existingDraft.sourceKind,
        ...(existingDraft.sourceText ? { sourceText: existingDraft.sourceText } : {}),
        mode: existingDraft.mode,
        createdAt: existingDraft.createdAt,
    });

    return okOp({
        draft,
        settings: await getPromptLayerSettings(input.profileId, existingDraft.workspaceFingerprint),
    });
}

export async function discardModeDraft(input: {
    profileId: string;
    draftId: string;
}): Promise<OperationalResult<PromptLayerSettings>> {
    const existingDraft = await modeDraftStore.getById(input.profileId, input.draftId);
    if (!existingDraft) {
        return errOp('not_found', `Mode draft "${input.draftId}" was not found.`);
    }

    await modeDraftStore.delete(input.profileId, input.draftId);
    return okOp(await getPromptLayerSettings(input.profileId, existingDraft.workspaceFingerprint));
}

export async function importCustomModeToDraft(
    input: PromptLayerImportCustomModeInput
): Promise<OperationalResult<{ draft: ModeDraftRecord; settings: PromptLayerSettings }>> {
    const parsedPortableMode = parsePortableCustomModeJson(input.jsonText);
    const draft = await persistModeDraft({
        profileId: input.profileId,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        sourceKind: parsedPortableMode.version === 'v2' ? 'portable_json_v2' : 'portable_json_v1',
        sourceText: input.jsonText,
        mode: toDraftModePayloadFromPortableImport({
            parsed: parsedPortableMode,
            ...(input.topLevelTab ? { topLevelTab: input.topLevelTab } : {}),
        }),
    });

    return okOp({
        draft,
        settings: await getPromptLayerSettings(input.profileId, input.workspaceFingerprint),
    });
}

export async function applyModeDraft(
    input: PromptLayerApplyModeDraftInput
): Promise<OperationalResult<{ draft: ModeDraftRecord; settings: PromptLayerSettings }>> {
    const existingDraft = await modeDraftStore.getById(input.profileId, input.draftId);
    if (!existingDraft) {
        return errOp('not_found', `Mode draft "${input.draftId}" was not found.`);
    }

    const validation = validateDraftPayload(existingDraft.mode);
    const draft = await modeDraftStore.upsert({
        profileId: existingDraft.profileId,
        draftId: existingDraft.id,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
        sourceKind: existingDraft.sourceKind,
        ...(existingDraft.sourceText ? { sourceText: existingDraft.sourceText } : {}),
        mode: existingDraft.mode,
        validationState: validation.validationState,
        validationErrors: validation.validationErrors,
        createdAt: existingDraft.createdAt,
    });
    if (!validation.canonicalPayload) {
        return errOp('invalid_input', validation.validationErrors.join(' '));
    }

    const renderedMode = renderCanonicalModeMarkdown({
        payload: validation.canonicalPayload,
    });
    const existingMode = await findFileBackedCustomMode({
        profileId: input.profileId,
        topLevelTab: renderedMode.topLevelTab,
        modeKey: renderedMode.modeKey,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
    });
    const directory = await resolveCustomModeDirectory({
        profileId: input.profileId,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
    });
    const absolutePath =
        existingMode?.originPath ?? path.join(directory, `${renderedMode.topLevelTab}-${renderedMode.modeKey}.md`);
    const exists = existingMode !== undefined || (await fileExists(absolutePath));
    if (exists && !input.overwrite) {
        return errOp(
            'invalid_input',
            `A ${existingDraft.scope} file-backed mode already exists for "${renderedMode.topLevelTab}:${renderedMode.modeKey}". Re-run with overwrite confirmation to replace it.`
        );
    }

    await writePortableModeFile({
        absolutePath,
        fileContent: renderedMode.fileContent,
    });

    const refreshed = await refreshDiscoveredModesForScope({
        profileId: input.profileId,
        scope: existingDraft.scope,
        ...(existingDraft.workspaceFingerprint ? { workspaceFingerprint: existingDraft.workspaceFingerprint } : {}),
    });
    if (refreshed.isErr()) {
        return errOp(refreshed.error.code, refreshed.error.message);
    }

    await modeDraftStore.delete(input.profileId, existingDraft.id);

    return okOp({
        draft,
        settings: await getPromptLayerSettings(input.profileId, existingDraft.workspaceFingerprint),
    });
}
