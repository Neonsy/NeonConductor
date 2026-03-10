import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { MessageMediaRecord } from '@/app/backend/persistence/types';
import type { SessionMessageMediaPayload } from '@/app/backend/runtime/contracts';
import { readImageMimeType } from '@/app/shared/imageMimeType';

function normalizeMediaBytes(bytes: ArrayBuffer | Uint8Array): Uint8Array {
    if (bytes instanceof Uint8Array) {
        return new Uint8Array(bytes);
    }

    return new Uint8Array(bytes);
}

function mapMessageMediaRecord(row: {
    media_id: string;
    message_part_id: string;
    mime_type: string;
    width: number;
    height: number;
    byte_size: number;
    sha256: string;
    created_at: string;
}): MessageMediaRecord {
    return {
        mediaId: row.media_id,
        messagePartId: parseEntityId(row.message_part_id, 'message_media.message_part_id', 'part'),
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        byteSize: row.byte_size,
        sha256: row.sha256,
        createdAt: row.created_at,
    };
}

export class MessageMediaStore {
    async create(input: {
        mediaId: string;
        messagePartId: string;
        mimeType: string;
        width: number;
        height: number;
        sha256: string;
        bytes: Uint8Array;
    }): Promise<MessageMediaRecord> {
        const { db } = getPersistence();
        const createdAt = nowIso();

        await db
            .insertInto('message_media')
            .values({
                media_id: input.mediaId,
                message_part_id: input.messagePartId,
                mime_type: input.mimeType,
                width: input.width,
                height: input.height,
                byte_size: input.bytes.byteLength,
                sha256: input.sha256,
                bytes_blob: input.bytes,
                created_at: createdAt,
            })
            .execute();

        const row = await db
            .selectFrom('message_media')
            .select([
                'media_id',
                'message_part_id',
                'mime_type',
                'width',
                'height',
                'byte_size',
                'sha256',
                'created_at',
            ])
            .where('media_id', '=', input.mediaId)
            .executeTakeFirstOrThrow();

        return mapMessageMediaRecord(row);
    }

    async getByMediaId(mediaId: string): Promise<MessageMediaRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('message_media')
            .select([
                'media_id',
                'message_part_id',
                'mime_type',
                'width',
                'height',
                'byte_size',
                'sha256',
                'created_at',
            ])
            .where('media_id', '=', mediaId)
            .executeTakeFirst();

        return row ? mapMessageMediaRecord(row) : null;
    }

    async getPayload(mediaId: string): Promise<SessionMessageMediaPayload | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('message_media')
            .select(['mime_type', 'bytes_blob', 'byte_size', 'width', 'height', 'sha256'])
            .where('media_id', '=', mediaId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        const mimeType = readImageMimeType(row.mime_type);
        if (!mimeType) {
            throw new Error(`Unsupported media mime type "${row.mime_type}" in message_media.`);
        }

        return {
            mimeType,
            bytes: normalizeMediaBytes(row.bytes_blob),
            byteSize: row.byte_size,
            width: row.width,
            height: row.height,
            sha256: row.sha256,
        };
    }

    async getPayloadForProfile(profileId: string, mediaId: string): Promise<SessionMessageMediaPayload | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('message_media')
            .innerJoin('message_parts', 'message_parts.id', 'message_media.message_part_id')
            .innerJoin('messages', 'messages.id', 'message_parts.message_id')
            .select([
                'message_media.mime_type as mime_type',
                'message_media.bytes_blob as bytes_blob',
                'message_media.byte_size as byte_size',
                'message_media.width as width',
                'message_media.height as height',
                'message_media.sha256 as sha256',
            ])
            .where('message_media.media_id', '=', mediaId)
            .where('messages.profile_id', '=', profileId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        const mimeType = readImageMimeType(row.mime_type);
        if (!mimeType) {
            throw new Error(`Unsupported media mime type "${row.mime_type}" in message_media.`);
        }

        return {
            mimeType,
            bytes: normalizeMediaBytes(row.bytes_blob),
            byteSize: row.byte_size,
            width: row.width,
            height: row.height,
            sha256: row.sha256,
        };
    }
}

export const messageMediaStore = new MessageMediaStore();
