import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/shared/rowParsers';
import {
    isJsonRecord,
    isJsonString,
    isJsonUnknownArray,
    nowIso,
    parseJsonValue,
} from '@/app/backend/persistence/stores/shared/utils';
import type { ModeDraftRecord } from '@/app/backend/runtime/contracts';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

import { modeAuthoringRoles, modeRoleTemplateKeys, topLevelTabs } from '@/shared/contracts';

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseDraftPayload(value: string): ModeDraftRecord['mode'] {
    const parsed = parseJsonValue(value, {}, isJsonRecord);
    const topLevelTab =
        typeof parsed['topLevelTab'] === 'string' && topLevelTabs.includes(parsed['topLevelTab'] as (typeof topLevelTabs)[number])
            ? (parsed['topLevelTab'] as (typeof topLevelTabs)[number])
            : undefined;
    const authoringRole =
        typeof parsed['authoringRole'] === 'string' &&
        modeAuthoringRoles.includes(parsed['authoringRole'] as (typeof modeAuthoringRoles)[number])
            ? (parsed['authoringRole'] as (typeof modeAuthoringRoles)[number])
            : undefined;
    const roleTemplate =
        typeof parsed['roleTemplate'] === 'string' &&
        modeRoleTemplateKeys.includes(parsed['roleTemplate'] as (typeof modeRoleTemplateKeys)[number])
            ? (parsed['roleTemplate'] as (typeof modeRoleTemplateKeys)[number])
            : undefined;
    const tags = parseJsonValue(JSON.stringify(parsed['tags'] ?? []), [], isJsonUnknownArray)
        .filter(isJsonString)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    const slug = readString(parsed['slug']);
    const name = readString(parsed['name']);
    const description = readString(parsed['description']);
    const roleDefinition = readString(parsed['roleDefinition']);
    const customInstructions = readString(parsed['customInstructions']);
    const whenToUse = readString(parsed['whenToUse']);

    return {
        ...(topLevelTab ? { topLevelTab } : {}),
        ...(slug ? { slug } : {}),
        ...(name ? { name } : {}),
        ...(authoringRole ? { authoringRole } : {}),
        ...(roleTemplate ? { roleTemplate } : {}),
        ...(description ? { description } : {}),
        ...(roleDefinition ? { roleDefinition } : {}),
        ...(customInstructions ? { customInstructions } : {}),
        ...(whenToUse ? { whenToUse } : {}),
        ...(tags.length > 0 ? { tags: Array.from(new Set(tags)) } : {}),
    };
}

function parseValidationErrors(value: string): string[] {
    const parsed = parseJsonValue(value, [], isJsonUnknownArray)
        .filter(isJsonString)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return Array.from(new Set(parsed));
}

function mapModeDraft(row: {
    id: string;
    profile_id: string;
    scope: string;
    workspace_fingerprint: string | null;
    source_kind: string;
    source_text: string | null;
    draft_json: string;
    validation_state: string;
    validation_errors_json: string;
    created_at: string;
    updated_at: string;
}): ModeDraftRecord {
    return {
        id: parseEntityId(row.id, 'mode_drafts.id', 'mdr'),
        profileId: row.profile_id,
        scope: parseEnumValue(row.scope, 'mode_drafts.scope', ['global', 'workspace'] as const),
        ...(row.workspace_fingerprint ? { workspaceFingerprint: row.workspace_fingerprint } : {}),
        sourceKind: parseEnumValue(
            row.source_kind,
            'mode_drafts.source_kind',
            ['manual', 'portable_json_v1', 'portable_json_v2', 'pasted_source_material'] as const
        ),
        ...(row.source_text ? { sourceText: row.source_text } : {}),
        mode: parseDraftPayload(row.draft_json),
        validationState: parseEnumValue(
            row.validation_state,
            'mode_drafts.validation_state',
            ['unvalidated', 'valid', 'invalid'] as const
        ),
        validationErrors: parseValidationErrors(row.validation_errors_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class ModeDraftStore {
    async listByProfile(profileId: string): Promise<ModeDraftRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('mode_drafts')
            .selectAll()
            .where('profile_id', '=', profileId)
            .orderBy('updated_at', 'desc')
            .execute();

        return rows.map(mapModeDraft);
    }

    async getById(profileId: string, draftId: string): Promise<ModeDraftRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('mode_drafts')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('id', '=', draftId)
            .executeTakeFirst();

        return row ? mapModeDraft(row) : null;
    }

    async upsert(input: {
        profileId: string;
        draftId?: string;
        scope: 'global' | 'workspace';
        workspaceFingerprint?: string;
        sourceKind: ModeDraftRecord['sourceKind'];
        sourceText?: string;
        mode: ModeDraftRecord['mode'];
        validationState: ModeDraftRecord['validationState'];
        validationErrors: string[];
        createdAt?: string;
    }): Promise<ModeDraftRecord> {
        const { db } = getPersistence();
        const createdAt = input.createdAt ?? nowIso();
        const updatedAt = nowIso();
        const id = input.draftId ?? createEntityId('mdr');

        await db
            .insertInto('mode_drafts')
            .values({
                id,
                profile_id: input.profileId,
                scope: input.scope,
                workspace_fingerprint: input.workspaceFingerprint ?? null,
                source_kind: input.sourceKind,
                source_text: input.sourceText ?? null,
                draft_json: JSON.stringify(input.mode),
                validation_state: input.validationState,
                validation_errors_json: JSON.stringify(input.validationErrors),
                created_at: createdAt,
                updated_at: updatedAt,
            })
            .onConflict((oc) =>
                oc.column('id').doUpdateSet({
                    scope: input.scope,
                    workspace_fingerprint: input.workspaceFingerprint ?? null,
                    source_kind: input.sourceKind,
                    source_text: input.sourceText ?? null,
                    draft_json: JSON.stringify(input.mode),
                    validation_state: input.validationState,
                    validation_errors_json: JSON.stringify(input.validationErrors),
                    updated_at: updatedAt,
                })
            )
            .execute();

        return {
            id,
            profileId: input.profileId,
            scope: input.scope,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            sourceKind: input.sourceKind,
            ...(input.sourceText ? { sourceText: input.sourceText } : {}),
            mode: input.mode,
            validationState: input.validationState,
            validationErrors: Array.from(new Set(input.validationErrors)),
            createdAt,
            updatedAt,
        };
    }

    async delete(profileId: string, draftId: string): Promise<void> {
        const { db } = getPersistence();
        await db.deleteFrom('mode_drafts').where('profile_id', '=', profileId).where('id', '=', draftId).execute();
    }
}

export const modeDraftStore = new ModeDraftStore();
