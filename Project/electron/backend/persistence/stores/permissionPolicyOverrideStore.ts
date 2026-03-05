import { getPersistence } from '@/app/backend/persistence/db';
import { parseEnumValue } from '@/app/backend/persistence/stores/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { PermissionPolicyOverrideRecord } from '@/app/backend/persistence/types';
import { permissionPolicies } from '@/app/backend/runtime/contracts';
import type { PermissionPolicy } from '@/app/backend/runtime/contracts';

const PROFILE_SCOPE_KEY = '__profile__';

function mapPermissionPolicyOverrideRecord(row: {
    profile_id: string;
    scope_key: string;
    resource: string;
    policy: string;
    created_at: string;
    updated_at: string;
}): PermissionPolicyOverrideRecord {
    return {
        profileId: row.profile_id,
        scopeKey: row.scope_key,
        resource: row.resource,
        policy: parseEnumValue(row.policy, 'permission_policy_overrides.policy', permissionPolicies),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class PermissionPolicyOverrideStore {
    toProfileScopeKey(): string {
        return PROFILE_SCOPE_KEY;
    }

    toWorkspaceScopeKey(workspaceFingerprint: string): string {
        return `workspace:${workspaceFingerprint}`;
    }

    async get(profileId: string, scopeKey: string, resource: string): Promise<PermissionPolicyOverrideRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('permission_policy_overrides')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('scope_key', '=', scopeKey)
            .where('resource', '=', resource)
            .executeTakeFirst();

        return row ? mapPermissionPolicyOverrideRecord(row) : null;
    }

    async upsert(
        profileId: string,
        scopeKey: string,
        resource: string,
        policy: PermissionPolicy
    ): Promise<PermissionPolicyOverrideRecord> {
        const { db } = getPersistence();
        const now = nowIso();

        await db
            .insertInto('permission_policy_overrides')
            .values({
                profile_id: profileId,
                scope_key: scopeKey,
                resource,
                policy,
                created_at: now,
                updated_at: now,
            })
            .onConflict((conflict) =>
                conflict.columns(['profile_id', 'scope_key', 'resource']).doUpdateSet({
                    policy,
                    updated_at: now,
                })
            )
            .execute();

        const row = await db
            .selectFrom('permission_policy_overrides')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('scope_key', '=', scopeKey)
            .where('resource', '=', resource)
            .executeTakeFirstOrThrow();

        return mapPermissionPolicyOverrideRecord(row);
    }
}

export const permissionPolicyOverrideStore = new PermissionPolicyOverrideStore();
