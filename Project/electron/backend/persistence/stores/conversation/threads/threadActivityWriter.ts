import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';

export async function touchThreadActivity(profileId: string, threadId: string): Promise<void> {
    const { db } = getPersistence();
    const now = nowIso();

    const thread = await db
        .updateTable('threads')
        .set({ updated_at: now })
        .where('id', '=', threadId)
        .where('profile_id', '=', profileId)
        .returning(['conversation_id'])
        .executeTakeFirst();

    if (!thread) {
        return;
    }

    await db
        .updateTable('conversations')
        .set({ updated_at: now })
        .where('id', '=', thread.conversation_id)
        .where('profile_id', '=', profileId)
        .execute();
}

export async function markThreadAssistantActivity(profileId: string, threadId: string, atIso: string): Promise<void> {
    const { db } = getPersistence();
    const existing = await db
        .selectFrom('threads')
        .select(['last_assistant_at', 'conversation_id'])
        .where('id', '=', threadId)
        .where('profile_id', '=', profileId)
        .executeTakeFirst();
    if (!existing) {
        return;
    }

    const nextLastAssistantAt =
        existing.last_assistant_at && existing.last_assistant_at > atIso ? existing.last_assistant_at : atIso;
    await db
        .updateTable('threads')
        .set({
            last_assistant_at: nextLastAssistantAt,
            updated_at: nowIso(),
        })
        .where('id', '=', threadId)
        .where('profile_id', '=', profileId)
        .execute();
    await db
        .updateTable('conversations')
        .set({ updated_at: nowIso() })
        .where('id', '=', existing.conversation_id)
        .where('profile_id', '=', profileId)
        .execute();
}
