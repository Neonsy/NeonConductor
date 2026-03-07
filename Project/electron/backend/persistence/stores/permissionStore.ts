import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/rowParsers';
import { isJsonRecord, isJsonString, nowIso, parseJsonValue } from '@/app/backend/persistence/stores/utils';
import type { PermissionRecord } from '@/app/backend/persistence/types';
import {
    createEntityId,
    permissionPolicies,
    permissionScopeKinds,
    type PermissionPolicy,
    type PermissionResolution,
} from '@/app/backend/runtime/contracts';

const permissionDecisions = ['pending', 'granted', 'denied'] as const;
const permissionResolvedScopes = ['once', 'profile', 'workspace'] as const;

function mapPermissionSummary(value: string): PermissionRecord['summary'] {
    const parsed = parseJsonValue(value, {}, isJsonRecord);
    const title = isJsonString(parsed['title']) ? parsed['title'] : 'Permission Request';
    const detail = isJsonString(parsed['detail']) ? parsed['detail'] : 'This action requires approval.';

    return {
        title,
        detail,
    };
}

function mapPermissionRecord(row: {
    id: string;
    profile_id: string;
    policy: string;
    resource: string;
    tool_id: string;
    workspace_fingerprint: string | null;
    scope_kind: string;
    summary_json: string;
    decision: string;
    resolved_scope: string | null;
    consumed_at: string | null;
    rationale: string | null;
    created_at: string;
    updated_at: string;
}): PermissionRecord {
    return {
        id: parseEntityId(row.id, 'permissions.id', 'perm'),
        profileId: row.profile_id,
        policy: parseEnumValue(row.policy, 'permissions.policy', permissionPolicies),
        resource: row.resource,
        toolId: row.tool_id,
        ...(row.workspace_fingerprint ? { workspaceFingerprint: row.workspace_fingerprint } : {}),
        scopeKind: parseEnumValue(row.scope_kind, 'permissions.scope_kind', permissionScopeKinds),
        summary: mapPermissionSummary(row.summary_json),
        decision: parseEnumValue(row.decision, 'permissions.decision', permissionDecisions),
        ...(row.resolved_scope
            ? {
                  resolvedScope: parseEnumValue(
                      row.resolved_scope,
                      'permissions.resolved_scope',
                      permissionResolvedScopes
                  ),
              }
            : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.consumed_at ? { consumedAt: row.consumed_at } : {}),
        ...(row.rationale ? { rationale: row.rationale } : {}),
    };
}

export class PermissionStore {
    async create(input: {
        profileId: string;
        policy: PermissionPolicy;
        resource: string;
        toolId: string;
        scopeKind: PermissionRecord['scopeKind'];
        summary: PermissionRecord['summary'];
        workspaceFingerprint?: string;
        rationale?: string;
    }): Promise<PermissionRecord> {
        const { db } = getPersistence();
        const now = nowIso();

        const inserted = await db
            .insertInto('permissions')
            .values({
                id: createEntityId('perm'),
                profile_id: input.profileId,
                policy: input.policy,
                resource: input.resource,
                tool_id: input.toolId,
                workspace_fingerprint: input.workspaceFingerprint ?? null,
                scope_kind: input.scopeKind,
                summary_json: JSON.stringify(input.summary),
                decision: 'pending',
                resolved_scope: null,
                consumed_at: null,
                rationale: input.rationale ?? null,
                created_at: now,
                updated_at: now,
            })
            .returning([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .executeTakeFirstOrThrow();

        return mapPermissionRecord(inserted);
    }

    async listPending(): Promise<PermissionRecord[]> {
        const { db } = getPersistence();

        const rows = await db
            .selectFrom('permissions')
            .select([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .where('decision', '=', 'pending')
            .orderBy('created_at', 'asc')
            .execute();

        return rows.map(mapPermissionRecord);
    }

    async getById(id: string): Promise<PermissionRecord | null> {
        const { db } = getPersistence();

        const row = await db
            .selectFrom('permissions')
            .select([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? mapPermissionRecord(row) : null;
    }

    async resolve(
        id: string,
        resolution: PermissionResolution
    ): Promise<PermissionRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();
        const decision = resolution === 'deny' ? 'denied' : 'granted';
        const resolvedScope =
            resolution === 'allow_once'
                ? 'once'
                : resolution === 'allow_profile'
                  ? 'profile'
                  : resolution === 'allow_workspace'
                    ? 'workspace'
                    : null;

        const row = await db
            .updateTable('permissions')
            .set({
                decision,
                resolved_scope: resolvedScope,
                updated_at: now,
            })
            .where('id', '=', id)
            .returning([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .executeTakeFirst();

        return row ? mapPermissionRecord(row) : null;
    }

    async consumeGrantedOnce(input: {
        profileId: string;
        resource: string;
        workspaceFingerprint?: string;
    }): Promise<PermissionRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();

        const request = await db
            .selectFrom('permissions')
            .select([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .where('profile_id', '=', input.profileId)
            .where('resource', '=', input.resource)
            .where('decision', '=', 'granted')
            .where('resolved_scope', '=', 'once')
            .where('consumed_at', 'is', null)
            .where((eb) =>
                input.workspaceFingerprint
                    ? eb('workspace_fingerprint', '=', input.workspaceFingerprint)
                    : eb('workspace_fingerprint', 'is', null)
            )
            .orderBy('updated_at', 'asc')
            .executeTakeFirst();
        if (!request) {
            return null;
        }

        const consumed = await db
            .updateTable('permissions')
            .set({
                consumed_at: now,
                updated_at: now,
            })
            .where('id', '=', request.id)
            .returning([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .executeTakeFirst();

        return consumed ? mapPermissionRecord(consumed) : null;
    }

    async listAll(): Promise<PermissionRecord[]> {
        const { db } = getPersistence();

        const rows = await db
            .selectFrom('permissions')
            .select([
                'id',
                'profile_id',
                'policy',
                'resource',
                'tool_id',
                'workspace_fingerprint',
                'scope_kind',
                'summary_json',
                'decision',
                'resolved_scope',
                'consumed_at',
                'rationale',
                'created_at',
                'updated_at',
            ])
            .orderBy('created_at', 'asc')
            .execute();

        return rows.map(mapPermissionRecord);
    }
}

export const permissionStore = new PermissionStore();
