import type { RuntimeResetCounts } from '@/app/backend/runtime/contracts';
import { listSecretKeyRefsByProfile } from '@/app/backend/runtime/services/runtimeReset/secrets';
import type {
    PlannedRuntimeResetOperation,
    RuntimeResetDatabase,
} from '@/app/backend/runtime/services/runtimeReset/types';
import { EMPTY_COUNTS } from '@/app/backend/runtime/services/runtimeReset/types';

async function resolveProfileSettingsCounts(
    db: RuntimeResetDatabase,
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

async function applyProfileSettingsDelete(db: RuntimeResetDatabase, profileId: string): Promise<void> {
    await db.deleteFrom('settings').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('mode_definitions').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('rulesets').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('skillfiles').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('kilo_account_snapshots').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('kilo_org_snapshots').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('secret_references').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('provider_auth_states').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('provider_auth_flows').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('provider_model_catalog').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('provider_discovery_snapshots').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('kilo_model_routing_preferences').where('profile_id', '=', profileId).execute();
    await db.deleteFrom('permission_policy_overrides').where('profile_id', '=', profileId).execute();
}

export async function planProfileSettingsReset(
    db: RuntimeResetDatabase,
    profileId: string
): Promise<PlannedRuntimeResetOperation> {
    const [counts, secretKeyRefs] = await Promise.all([
        resolveProfileSettingsCounts(db, profileId),
        listSecretKeyRefsByProfile(db, profileId),
    ]);

    return {
        counts,
        secretKeyRefs,
        reseedRuntimeData: false,
        apply: async (applyDb) => {
            await applyProfileSettingsDelete(applyDb, profileId);
        },
    };
}
