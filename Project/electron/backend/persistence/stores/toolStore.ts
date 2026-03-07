import { getPersistence } from '@/app/backend/persistence/db';
import { parseEnumValue } from '@/app/backend/persistence/stores/rowParsers';
import type { ToolRecord } from '@/app/backend/persistence/types';
import { permissionPolicies } from '@/app/backend/runtime/contracts';
import { getToolSafetyMetadata } from '@/app/backend/runtime/services/toolExecution/catalog';

function mapToolRecord(row: { id: string; label: string; description: string; permission_policy: string }): ToolRecord {
    return {
        id: row.id,
        label: row.label,
        description: row.description,
        permissionPolicy: parseEnumValue(row.permission_policy, 'tools_catalog.permission_policy', permissionPolicies),
        ...getToolSafetyMetadata(row.id),
    };
}

export class ToolStore {
    async list(): Promise<ToolRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('tools_catalog')
            .select(['id', 'label', 'description', 'permission_policy'])
            .orderBy('label', 'asc')
            .execute();

        return rows.map(mapToolRecord);
    }
}

export const toolStore = new ToolStore();
