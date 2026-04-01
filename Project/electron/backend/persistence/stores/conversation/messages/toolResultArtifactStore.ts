import { Buffer } from 'node:buffer';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getPersistence, getPersistenceStoragePaths } from '@/app/backend/persistence/db';
import {
    parseEntityId,
    parseEnumValue,
    parseJsonRecord,
} from '@/app/backend/persistence/stores/shared/rowParsers';
import {
    buildToolArtifactLineWindow,
    searchToolArtifactText,
    type ToolArtifactLineWindow,
    type ToolArtifactSearchMatch,
} from '@/app/backend/persistence/stores/conversation/messages/toolResultArtifactText';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { ToolResultArtifactRecord } from '@/app/backend/persistence/types';
import { appLog } from '@/app/main/logging';

const toolResultArtifactKinds = ['command_output', 'file_read', 'directory_listing', 'search_results'] as const;
const toolResultArtifactStorageKinds = ['text_inline_db', 'file_path'] as const;
const toolResultArtifactPreviewStrategies = ['head_tail', 'head_only', 'bounded_list'] as const;
const INLINE_DB_STORAGE_THRESHOLD_BYTES = 128_000;

function mapToolResultArtifactRecord(row: {
    message_part_id: string;
    profile_id: string;
    session_id: string;
    run_id: string;
    tool_name: string;
    artifact_kind: string;
    content_type: string;
    storage_kind: string;
    raw_text: string | null;
    file_path: string | null;
    total_bytes: number;
    total_lines: number;
    preview_text: string;
    preview_strategy: string;
    metadata_json: string;
    created_at: string;
    updated_at: string;
}): ToolResultArtifactRecord {
    return {
        messagePartId: parseEntityId(row.message_part_id, 'tool_result_artifacts.message_part_id', 'part'),
        profileId: row.profile_id,
        sessionId: parseEntityId(row.session_id, 'tool_result_artifacts.session_id', 'sess'),
        runId: parseEntityId(row.run_id, 'tool_result_artifacts.run_id', 'run'),
        toolName: row.tool_name,
        artifactKind: parseEnumValue(row.artifact_kind, 'tool_result_artifacts.artifact_kind', toolResultArtifactKinds),
        contentType: row.content_type,
        storageKind: parseEnumValue(row.storage_kind, 'tool_result_artifacts.storage_kind', toolResultArtifactStorageKinds),
        ...(row.raw_text ? { rawText: row.raw_text } : {}),
        ...(row.file_path ? { filePath: row.file_path } : {}),
        totalBytes: row.total_bytes,
        totalLines: row.total_lines,
        previewText: row.preview_text,
        previewStrategy: parseEnumValue(
            row.preview_strategy,
            'tool_result_artifacts.preview_strategy',
            toolResultArtifactPreviewStrategies
        ),
        metadata: parseJsonRecord(row.metadata_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function writeArtifactFile(absolutePath: string, rawText: string): Promise<void> {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const tempPath = `${absolutePath}.tmp`;
    await writeFile(tempPath, rawText, 'utf8');
    await rename(tempPath, absolutePath);
}

async function removeArtifactFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
}

export class ToolResultArtifactStore {
    async listByMessagePartIds(messagePartIds: string[]): Promise<ToolResultArtifactRecord[]> {
        if (messagePartIds.length === 0) {
            return [];
        }

        const { db } = getPersistence();
        const rows = await db
            .selectFrom('tool_result_artifacts')
            .selectAll()
            .where('message_part_id', 'in', messagePartIds)
            .execute();

        return rows.map(mapToolResultArtifactRecord);
    }

    private async deleteRows(rows: ToolResultArtifactRecord[]): Promise<void> {
        if (rows.length === 0) {
            return;
        }

        await Promise.all(
            rows.flatMap((row) => (row.filePath ? [removeArtifactFile(row.filePath)] : []))
        );

        const { db } = getPersistence();
        await db
            .deleteFrom('tool_result_artifacts')
            .where(
                'message_part_id',
                'in',
                rows.map((row) => row.messagePartId)
            )
            .execute();
    }

    private resolveArtifactFilePath(input: {
        profileId: string;
        sessionId: string;
        messagePartId: string;
    }): string {
        const { toolArtifactsRoot } = getPersistenceStoragePaths();
        return path.join(toolArtifactsRoot, input.profileId, input.sessionId, `${input.messagePartId}.txt`);
    }

    async create(input: {
        messagePartId: string;
        profileId: string;
        sessionId: string;
        runId: string;
        toolName: string;
        artifactKind: ToolResultArtifactRecord['artifactKind'];
        contentType: string;
        rawText: string;
        totalBytes: number;
        totalLines: number;
        previewText: string;
        previewStrategy: ToolResultArtifactRecord['previewStrategy'];
        metadata: Record<string, unknown>;
    }): Promise<ToolResultArtifactRecord> {
        const { db } = getPersistence();
        const existingRows = await this.listByMessagePartIds([input.messagePartId]);
        if (existingRows.length > 0) {
            await this.deleteRows(existingRows);
        }

        const createdAt = nowIso();
        const rawTextBytes = Buffer.byteLength(input.rawText, 'utf8');
        const useInlineStorage = rawTextBytes <= INLINE_DB_STORAGE_THRESHOLD_BYTES;
        const filePath = useInlineStorage
            ? null
            : this.resolveArtifactFilePath({
                  profileId: input.profileId,
                  sessionId: input.sessionId,
                  messagePartId: input.messagePartId,
              });

        if (filePath) {
            await writeArtifactFile(filePath, input.rawText);
        }

        await db
            .insertInto('tool_result_artifacts')
            .values({
                message_part_id: input.messagePartId,
                profile_id: input.profileId,
                session_id: input.sessionId,
                run_id: input.runId,
                tool_name: input.toolName,
                artifact_kind: input.artifactKind,
                content_type: input.contentType,
                storage_kind: useInlineStorage ? 'text_inline_db' : 'file_path',
                raw_text: useInlineStorage ? input.rawText : null,
                file_path: filePath,
                total_bytes: input.totalBytes,
                total_lines: input.totalLines,
                preview_text: input.previewText,
                preview_strategy: input.previewStrategy,
                metadata_json: JSON.stringify(input.metadata),
                created_at: createdAt,
                updated_at: createdAt,
            })
            .execute();

        appLog.debug({
            tag: 'tool-output-artifacts',
            message: 'Persisted tool result artifact.',
            messagePartId: input.messagePartId,
            profileId: input.profileId,
            sessionId: input.sessionId,
            storageKind: useInlineStorage ? 'text_inline_db' : 'file_path',
            totalBytes: input.totalBytes,
            previewBytes: Buffer.byteLength(input.previewText, 'utf8'),
            rawTextBytes,
        });

        const row = await db
            .selectFrom('tool_result_artifacts')
            .selectAll()
            .where('message_part_id', '=', input.messagePartId)
            .executeTakeFirstOrThrow();

        return mapToolResultArtifactRecord(row);
    }

    async getByMessagePartId(messagePartId: string): Promise<ToolResultArtifactRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('tool_result_artifacts')
            .selectAll()
            .where('message_part_id', '=', messagePartId)
            .executeTakeFirst();

        return row ? mapToolResultArtifactRecord(row) : null;
    }

    async getRawText(messagePartId: string): Promise<string | null> {
        const record = await this.getByMessagePartId(messagePartId);
        if (!record) {
            return null;
        }

        if (record.storageKind === 'text_inline_db') {
            return record.rawText ?? null;
        }

        if (!record.filePath) {
            return null;
        }

        try {
            return await readFile(record.filePath, 'utf8');
        } catch {
            return null;
        }
    }

    async readLineWindow(input: {
        messagePartId: string;
        startLine?: number;
        lineCount?: number;
    }): Promise<(ToolArtifactLineWindow & { artifact: ToolResultArtifactRecord }) | null> {
        const artifact = await this.getByMessagePartId(input.messagePartId);
        if (!artifact) {
            return null;
        }

        const rawText = await this.getRawText(input.messagePartId);
        if (rawText === null) {
            return null;
        }

        return {
            artifact,
            ...buildToolArtifactLineWindow({
                rawText,
                ...(input.startLine !== undefined ? { startLine: input.startLine } : {}),
                ...(input.lineCount !== undefined ? { lineCount: input.lineCount } : {}),
            }),
        };
    }

    async search(input: {
        messagePartId: string;
        query: string;
        caseSensitive?: boolean;
    }): Promise<{ artifact: ToolResultArtifactRecord; matches: ToolArtifactSearchMatch[]; truncated: boolean } | null> {
        const artifact = await this.getByMessagePartId(input.messagePartId);
        if (!artifact) {
            return null;
        }

        const rawText = await this.getRawText(input.messagePartId);
        if (rawText === null) {
            return null;
        }

        const searchResult = searchToolArtifactText({
            rawText,
            query: input.query,
            ...(input.caseSensitive !== undefined ? { caseSensitive: input.caseSensitive } : {}),
        });

        return {
            artifact,
            matches: searchResult.matches,
            truncated: searchResult.truncated,
        };
    }

    async deleteBySessionIds(sessionIds: string[]): Promise<void> {
        if (sessionIds.length === 0) {
            return;
        }

        const { db } = getPersistence();
        const rows = await db
            .selectFrom('tool_result_artifacts')
            .selectAll()
            .where('session_id', 'in', sessionIds)
            .execute();

        await this.deleteRows(rows.map(mapToolResultArtifactRecord));
    }

    async deleteByProfile(profileId: string): Promise<void> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('tool_result_artifacts')
            .selectAll()
            .where('profile_id', '=', profileId)
            .execute();

        await this.deleteRows(rows.map(mapToolResultArtifactRecord));
    }

    async deleteAll(): Promise<void> {
        const { db } = getPersistence();
        const rows = await db.selectFrom('tool_result_artifacts').selectAll().execute();
        await this.deleteRows(rows.map(mapToolResultArtifactRecord));
    }
}

export const toolResultArtifactStore = new ToolResultArtifactStore();
