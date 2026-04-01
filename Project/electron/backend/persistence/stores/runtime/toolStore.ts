import { getPersistence } from '@/app/backend/persistence/db';
import { parseEnumValue } from '@/app/backend/persistence/stores/shared/rowParsers';
import type { ToolRecord } from '@/app/backend/persistence/types';
import { permissionPolicies } from '@/app/backend/runtime/contracts';
import type { BuiltInToolMetadataEntry } from '@/app/backend/runtime/contracts';
import { getToolSafetyMetadata } from '@/app/backend/runtime/services/toolExecution/catalog';
import {
    builtInNativeToolDefinitions,
    builtInNativeToolOrder,
    getBuiltInNativeToolDefinition,
} from '@/app/backend/runtime/services/toolExecution/builtInNativeTools';

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

    async listBuiltInMetadata(): Promise<BuiltInToolMetadataEntry[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('tools_catalog')
            .select(['id', 'label', 'description', 'permission_policy'])
            .where(
                'id',
                'in',
                builtInNativeToolDefinitions.map((definition) => definition.id)
            )
            .execute();

        const rowById = new Map(rows.map((row) => [row.id, row] as const));
        const metadataEntries: BuiltInToolMetadataEntry[] = [];
        for (const toolId of builtInNativeToolOrder) {
            const builtInDefinition = getBuiltInNativeToolDefinition(toolId);
            if (!builtInDefinition) {
                continue;
            }

            const storedRow = rowById.get(toolId);
            const description = storedRow?.description ?? builtInDefinition.defaultDescription;
            metadataEntries.push({
                toolId,
                label: storedRow?.label ?? builtInDefinition.label,
                description,
                defaultDescription: builtInDefinition.defaultDescription,
                isModified: description !== builtInDefinition.defaultDescription,
            });
        }

        return metadataEntries;
    }

    async setBuiltInDescription(toolId: string, description: string): Promise<BuiltInToolMetadataEntry[]> {
        const builtInDefinition = getBuiltInNativeToolDefinition(toolId);
        if (!builtInDefinition) {
            throw new Error(`Unknown built-in native tool "${toolId}".`);
        }

        const normalizedDescription = description.trim();
        if (normalizedDescription.length === 0) {
            throw new Error('Built-in tool description cannot be empty.');
        }

        const { db } = getPersistence();
        const now = new Date().toISOString();
        await db
            .insertInto('tools_catalog')
            .values({
                id: builtInDefinition.id,
                label: builtInDefinition.label,
                description: normalizedDescription,
                permission_policy: builtInDefinition.permissionPolicy,
                created_at: now,
                updated_at: now,
            })
            .onConflict((conflict) =>
                conflict.column('id').doUpdateSet({
                    description: normalizedDescription,
                    updated_at: now,
                })
            )
            .execute();

        return this.listBuiltInMetadata();
    }

    async resetBuiltInDescription(toolId: string): Promise<BuiltInToolMetadataEntry[]> {
        const builtInDefinition = getBuiltInNativeToolDefinition(toolId);
        if (!builtInDefinition) {
            throw new Error(`Unknown built-in native tool "${toolId}".`);
        }

        const { db } = getPersistence();
        const now = new Date().toISOString();
        await db
            .insertInto('tools_catalog')
            .values({
                id: builtInDefinition.id,
                label: builtInDefinition.label,
                description: builtInDefinition.defaultDescription,
                permission_policy: builtInDefinition.permissionPolicy,
                created_at: now,
                updated_at: now,
            })
            .onConflict((conflict) =>
                conflict.column('id').doUpdateSet({
                    description: builtInDefinition.defaultDescription,
                    updated_at: now,
                })
            )
            .execute();

        return this.listBuiltInMetadata();
    }
}

export const toolStore = new ToolStore();
