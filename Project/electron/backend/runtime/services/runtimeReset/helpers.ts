import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import type { RuntimeResetCounts, RuntimeResetInput } from '@/app/backend/runtime/contracts';
import { getSecretStore } from '@/app/backend/secrets/store';

import type { Kysely } from 'kysely';

export const EMPTY_COUNTS: RuntimeResetCounts = {
    settings: 0,
    runtimeEvents: 0,
    sessions: 0,
    runs: 0,
    messages: 0,
    messageParts: 0,
    runUsage: 0,
    permissions: 0,
    conversations: 0,
    threads: 0,
    threadTags: 0,
    tags: 0,
    diffs: 0,
    modeDefinitions: 0,
    rulesets: 0,
    skillfiles: 0,
    marketplacePackages: 0,
    marketplaceAssets: 0,
    kiloAccountSnapshots: 0,
    kiloOrgSnapshots: 0,
    secretReferences: 0,
    providerAuthStates: 0,
    providerAuthFlows: 0,
    providerCatalogModels: 0,
    providerDiscoverySnapshots: 0,
    kiloModelRoutingPreferences: 0,
};

export interface WorkspaceResolvedCounts {
    counts: RuntimeResetCounts;
    sessionIds: string[];
    conversationIds: string[];
    tagIds: string[];
    rulesetIds: string[];
    skillfileIds: string[];
    entityIds: string[];
}

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

async function listWorkspaceSessionIds(db: Kysely<DatabaseSchema>, conversationIds: string[]): Promise<string[]> {
    if (conversationIds.length === 0) {
        return [];
    }

    const query = db.selectFrom('sessions').select('id').where('conversation_id', 'in', conversationIds);
    const rows = await query.execute();
    return rows.map((row) => row.id);
}

async function listWorkspaceConversationIds(
    db: Kysely<DatabaseSchema>,
    target: RuntimeResetInput['target'],
    workspaceFingerprint?: string
): Promise<string[]> {
    let query = db.selectFrom('conversations').select('id');

    if (target === 'workspace') {
        query = query.where('workspace_fingerprint', '=', workspaceFingerprint ?? '');
    } else {
        query = query.where('scope', '=', 'workspace');
    }

    const rows = await query.execute();
    return rows.map((row) => row.id);
}

async function listWorkspaceParityIds(
    db: Kysely<DatabaseSchema>,
    table: 'rulesets' | 'skillfiles',
    target: RuntimeResetInput['target'],
    workspaceFingerprint?: string
): Promise<string[]> {
    let query = db.selectFrom(table).select('id');

    if (target === 'workspace') {
        query = query.where('workspace_fingerprint', '=', workspaceFingerprint ?? '');
    } else {
        query = query.where('workspace_fingerprint', 'is not', null);
    }

    const rows = await query.execute();
    return rows.map((row) => row.id);
}

async function listThreadIds(db: Kysely<DatabaseSchema>, conversationIds: string[]): Promise<string[]> {
    if (conversationIds.length === 0) {
        return [];
    }

    const rows = await db.selectFrom('threads').select('id').where('conversation_id', 'in', conversationIds).execute();

    return rows.map((row) => row.id);
}

async function listRunIds(db: Kysely<DatabaseSchema>, sessionIds: string[]): Promise<string[]> {
    if (sessionIds.length === 0) {
        return [];
    }

    const rows = await db.selectFrom('runs').select('id').where('session_id', 'in', sessionIds).execute();

    return rows.map((row) => row.id);
}

async function listDiffIds(db: Kysely<DatabaseSchema>, sessionIds: string[]): Promise<string[]> {
    if (sessionIds.length === 0) {
        return [];
    }

    const rows = await db.selectFrom('diffs').select('id').where('session_id', 'in', sessionIds).execute();

    return rows.map((row) => row.id);
}

async function countMessagesBySessionIds(db: Kysely<DatabaseSchema>, sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) {
        return 0;
    }

    const row = await db
        .selectFrom('messages')
        .select((eb) => eb.fn.count<number>('id').as('count'))
        .where('session_id', 'in', sessionIds)
        .executeTakeFirst();

    return row?.count ?? 0;
}

async function countMessagePartsBySessionIds(db: Kysely<DatabaseSchema>, sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) {
        return 0;
    }

    const row = await db
        .selectFrom('message_parts')
        .innerJoin('messages', 'messages.id', 'message_parts.message_id')
        .select((eb) => eb.fn.count<number>('message_parts.id').as('count'))
        .where('messages.session_id', 'in', sessionIds)
        .executeTakeFirst();

    return row?.count ?? 0;
}

async function countRunUsageByRunIds(db: Kysely<DatabaseSchema>, runIds: string[]): Promise<number> {
    if (runIds.length === 0) {
        return 0;
    }

    const row = await db
        .selectFrom('run_usage')
        .select((eb) => eb.fn.count<number>('run_id').as('count'))
        .where('run_id', 'in', runIds)
        .executeTakeFirst();

    return row?.count ?? 0;
}

async function listThreadTagIdsToDelete(db: Kysely<DatabaseSchema>, threadIds: string[]): Promise<string[]> {
    if (threadIds.length === 0) {
        return [];
    }

    const rows = await db
        .selectFrom('thread_tags')
        .select('tag_id')
        .distinct()
        .where('thread_id', 'in', threadIds)
        .execute();

    const tagIds = rows.map((row) => row.tag_id);
    const deletableTagIds: string[] = [];

    for (const tagId of tagIds) {
        const nonWorkspaceReferences = await db
            .selectFrom('thread_tags')
            .select('tag_id')
            .where('tag_id', '=', tagId)
            .where((eb) => eb.not(eb('thread_id', 'in', threadIds)))
            .executeTakeFirst();

        if (!nonWorkspaceReferences) {
            deletableTagIds.push(tagId);
        }
    }

    return deletableTagIds;
}

async function countRuntimeEventsForEntityIds(db: Kysely<DatabaseSchema>, entityIds: string[]): Promise<number> {
    if (entityIds.length === 0) {
        return 0;
    }

    const row = await db
        .selectFrom('runtime_events')
        .select((eb) => eb.fn.count<number>('sequence').as('count'))
        .where('entity_id', 'in', entityIds)
        .executeTakeFirst();

    return row?.count ?? 0;
}

export async function removeSecretsByReferences(secretKeyRefs: string[]): Promise<void> {
    if (secretKeyRefs.length === 0) {
        return;
    }

    const store = getSecretStore();
    await Promise.allSettled(unique(secretKeyRefs).map((secretKeyRef) => store.delete(secretKeyRef)));
}

export async function resolveWorkspaceCounts(
    db: Kysely<DatabaseSchema>,
    target: 'workspace' | 'workspace_all',
    workspaceFingerprint?: string
): Promise<WorkspaceResolvedCounts> {
    const conversationIds = await listWorkspaceConversationIds(db, target, workspaceFingerprint);
    const sessionIds = await listWorkspaceSessionIds(db, conversationIds);
    const threadIds = await listThreadIds(db, conversationIds);
    const runIds = await listRunIds(db, sessionIds);
    const diffIds = await listDiffIds(db, sessionIds);
    const rulesetIds = await listWorkspaceParityIds(db, 'rulesets', target, workspaceFingerprint);
    const skillfileIds = await listWorkspaceParityIds(db, 'skillfiles', target, workspaceFingerprint);

    const threadTagRows = threadIds.length
        ? await db
              .selectFrom('thread_tags')
              .select(['thread_id', 'tag_id'])
              .where('thread_id', 'in', threadIds)
              .execute()
        : [];

    const tagIds = await listThreadTagIdsToDelete(db, threadIds);
    const entityIds = unique([
        ...sessionIds,
        ...runIds,
        ...conversationIds,
        ...threadIds,
        ...diffIds,
        ...tagIds,
        ...rulesetIds,
        ...skillfileIds,
    ]);

    return {
        counts: {
            ...EMPTY_COUNTS,
            runtimeEvents: await countRuntimeEventsForEntityIds(db, entityIds),
            sessions: sessionIds.length,
            runs: runIds.length,
            messages: await countMessagesBySessionIds(db, sessionIds),
            messageParts: await countMessagePartsBySessionIds(db, sessionIds),
            runUsage: await countRunUsageByRunIds(db, runIds),
            conversations: conversationIds.length,
            threads: threadIds.length,
            threadTags: threadTagRows.length,
            tags: tagIds.length,
            diffs: diffIds.length,
            rulesets: rulesetIds.length,
            skillfiles: skillfileIds.length,
        },
        sessionIds,
        conversationIds,
        tagIds,
        rulesetIds,
        skillfileIds,
        entityIds,
    };
}

export async function applyWorkspaceDelete(
    db: Kysely<DatabaseSchema>,
    resolved: WorkspaceResolvedCounts
): Promise<void> {
    if (resolved.entityIds.length > 0) {
        await db.deleteFrom('runtime_events').where('entity_id', 'in', resolved.entityIds).execute();
    }

    if (resolved.sessionIds.length > 0) {
        await db.deleteFrom('sessions').where('id', 'in', resolved.sessionIds).execute();
    }

    if (resolved.conversationIds.length > 0) {
        await db.deleteFrom('conversations').where('id', 'in', resolved.conversationIds).execute();
    }

    if (resolved.tagIds.length > 0) {
        await db.deleteFrom('tags').where('id', 'in', resolved.tagIds).execute();
    }

    if (resolved.rulesetIds.length > 0) {
        await db.deleteFrom('rulesets').where('id', 'in', resolved.rulesetIds).execute();
    }

    if (resolved.skillfileIds.length > 0) {
        await db.deleteFrom('skillfiles').where('id', 'in', resolved.skillfileIds).execute();
    }
}

export async function resolveProfileSettingsCounts(
    db: Kysely<DatabaseSchema>,
    profileId: string
): Promise<RuntimeResetCounts> {
    const [
        settings,
        modeDefinitions,
        rulesets,
        skillfiles,
        kiloAccountSnapshots,
        kiloOrgSnapshots,
        secretReferences,
        providerAuthStates,
        providerAuthFlows,
        providerCatalogModels,
        providerDiscoverySnapshots,
        kiloModelRoutingPreferences,
    ] = await Promise.all([
        db
            .selectFrom('settings')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('mode_definitions')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('rulesets')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('skillfiles')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('kilo_account_snapshots')
            .select((eb) => eb.fn.count<number>('profile_id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('kilo_org_snapshots')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('secret_references')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('provider_auth_states')
            .select((eb) => eb.fn.count<number>('provider_id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('provider_auth_flows')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('provider_model_catalog')
            .select((eb) => eb.fn.count<number>('model_id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('provider_discovery_snapshots')
            .select((eb) => eb.fn.count<number>('kind').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
        db
            .selectFrom('kilo_model_routing_preferences')
            .select((eb) => eb.fn.count<number>('model_id').as('count'))
            .where('profile_id', '=', profileId)
            .executeTakeFirst(),
    ]);

    return {
        ...EMPTY_COUNTS,
        settings: settings?.count ?? 0,
        modeDefinitions: modeDefinitions?.count ?? 0,
        rulesets: rulesets?.count ?? 0,
        skillfiles: skillfiles?.count ?? 0,
        kiloAccountSnapshots: kiloAccountSnapshots?.count ?? 0,
        kiloOrgSnapshots: kiloOrgSnapshots?.count ?? 0,
        secretReferences: secretReferences?.count ?? 0,
        providerAuthStates: providerAuthStates?.count ?? 0,
        providerAuthFlows: providerAuthFlows?.count ?? 0,
        providerCatalogModels: providerCatalogModels?.count ?? 0,
        providerDiscoverySnapshots: providerDiscoverySnapshots?.count ?? 0,
        kiloModelRoutingPreferences: kiloModelRoutingPreferences?.count ?? 0,
    };
}

export async function resolveFullCounts(db: Kysely<DatabaseSchema>): Promise<RuntimeResetCounts> {
    const [
        settings,
        runtimeEvents,
        sessions,
        runs,
        messages,
        messageParts,
        runUsage,
        permissions,
        conversations,
        threads,
        threadTags,
        tags,
        diffs,
        modeDefinitions,
        rulesets,
        skillfiles,
        marketplacePackages,
        marketplaceAssets,
        kiloAccountSnapshots,
        kiloOrgSnapshots,
        secretReferences,
        providerAuthStates,
        providerAuthFlows,
        providerCatalogModels,
        providerDiscoverySnapshots,
        kiloModelRoutingPreferences,
    ] = await Promise.all([
        db
            .selectFrom('settings')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('runtime_events')
            .select((eb) => eb.fn.count<number>('sequence').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('sessions')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('runs')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('messages')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('message_parts')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('run_usage')
            .select((eb) => eb.fn.count<number>('run_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('permissions')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('conversations')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('threads')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('thread_tags')
            .select((eb) => eb.fn.count<number>('thread_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('tags')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('diffs')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('mode_definitions')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('rulesets')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('skillfiles')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('marketplace_packages')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('marketplace_assets')
            .select((eb) => eb.fn.count<number>('package_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('kilo_account_snapshots')
            .select((eb) => eb.fn.count<number>('profile_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('kilo_org_snapshots')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('secret_references')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('provider_auth_states')
            .select((eb) => eb.fn.count<number>('provider_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('provider_auth_flows')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('provider_model_catalog')
            .select((eb) => eb.fn.count<number>('model_id').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('provider_discovery_snapshots')
            .select((eb) => eb.fn.count<number>('kind').as('count'))
            .executeTakeFirst(),
        db
            .selectFrom('kilo_model_routing_preferences')
            .select((eb) => eb.fn.count<number>('model_id').as('count'))
            .executeTakeFirst(),
    ]);

    return {
        settings: settings?.count ?? 0,
        runtimeEvents: runtimeEvents?.count ?? 0,
        sessions: sessions?.count ?? 0,
        runs: runs?.count ?? 0,
        messages: messages?.count ?? 0,
        messageParts: messageParts?.count ?? 0,
        runUsage: runUsage?.count ?? 0,
        permissions: permissions?.count ?? 0,
        conversations: conversations?.count ?? 0,
        threads: threads?.count ?? 0,
        threadTags: threadTags?.count ?? 0,
        tags: tags?.count ?? 0,
        diffs: diffs?.count ?? 0,
        modeDefinitions: modeDefinitions?.count ?? 0,
        rulesets: rulesets?.count ?? 0,
        skillfiles: skillfiles?.count ?? 0,
        marketplacePackages: marketplacePackages?.count ?? 0,
        marketplaceAssets: marketplaceAssets?.count ?? 0,
        kiloAccountSnapshots: kiloAccountSnapshots?.count ?? 0,
        kiloOrgSnapshots: kiloOrgSnapshots?.count ?? 0,
        secretReferences: secretReferences?.count ?? 0,
        providerAuthStates: providerAuthStates?.count ?? 0,
        providerAuthFlows: providerAuthFlows?.count ?? 0,
        providerCatalogModels: providerCatalogModels?.count ?? 0,
        providerDiscoverySnapshots: providerDiscoverySnapshots?.count ?? 0,
        kiloModelRoutingPreferences: kiloModelRoutingPreferences?.count ?? 0,
    };
}
