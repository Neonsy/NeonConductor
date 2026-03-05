import { getPersistence, reseedRuntimeData } from '@/app/backend/persistence/db';
import { secretReferenceStore } from '@/app/backend/persistence/stores';
import type { RuntimeResetInput, RuntimeResetResult } from '@/app/backend/runtime/contracts';
import {
    applyWorkspaceDelete,
    resolveFullCounts,
    resolveProfileSettingsCounts,
    resolveWorkspaceCounts,
    removeSecretsByReferences,
} from '@/app/backend/runtime/services/runtimeReset/helpers';
import { appLog } from '@/app/main/logging';

export interface RuntimeResetService {
    reset(input: RuntimeResetInput): Promise<RuntimeResetResult>;
}

class RuntimeResetServiceImpl implements RuntimeResetService {
    async reset(input: RuntimeResetInput): Promise<RuntimeResetResult> {
        const startedAt = Date.now();
        appLog.info({
            tag: 'runtime.reset',
            message: 'Runtime reset requested.',
            target: input.target,
            dryRun: input.dryRun ?? false,
            ...(input.profileId ? { profileId: input.profileId } : {}),
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });

        const { db } = getPersistence();
        const dryRun = input.dryRun ?? false;

        try {
            if (input.target === 'workspace' || input.target === 'workspace_all') {
                const resolved = await resolveWorkspaceCounts(db, input.target, input.workspaceFingerprint);

                if (!dryRun) {
                    await applyWorkspaceDelete(db, resolved);
                }

                appLog.info({
                    tag: 'runtime.reset',
                    message: 'Completed workspace runtime reset.',
                    target: input.target,
                    dryRun,
                    applied: !dryRun,
                    durationMs: Date.now() - startedAt,
                    counts: resolved.counts,
                });

                return {
                    dryRun,
                    target: input.target,
                    applied: !dryRun,
                    counts: resolved.counts,
                };
            }

            if (input.target === 'profile_settings') {
                const profileId = input.profileId ?? '';
                const counts = await resolveProfileSettingsCounts(db, profileId);
                const secretRefs = await secretReferenceStore.listByProfile(profileId);

                if (!dryRun) {
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
                    await db.deleteFrom('permission_policy_overrides').where('profile_id', '=', profileId).execute();
                    await removeSecretsByReferences(secretRefs.map((secretRef) => secretRef.secretKeyRef));
                }

                appLog.info({
                    tag: 'runtime.reset',
                    message: 'Completed profile settings reset.',
                    target: input.target,
                    profileId,
                    dryRun,
                    applied: !dryRun,
                    durationMs: Date.now() - startedAt,
                    secretRefsRemoved: dryRun ? 0 : secretRefs.length,
                    counts,
                });

                return {
                    dryRun,
                    target: input.target,
                    applied: !dryRun,
                    counts,
                };
            }

            const counts = await resolveFullCounts(db);
            const secretRefs = await secretReferenceStore.listAll();

            if (!dryRun) {
                await db.deleteFrom('runtime_events').execute();
                await db.deleteFrom('permissions').execute();
                await db.deleteFrom('sessions').execute();
                await db.deleteFrom('conversations').execute();
                await db.deleteFrom('tags').execute();
                await db.deleteFrom('settings').execute();
                await db.deleteFrom('mode_definitions').execute();
                await db.deleteFrom('rulesets').execute();
                await db.deleteFrom('skillfiles').execute();
                await db.deleteFrom('kilo_account_snapshots').execute();
                await db.deleteFrom('kilo_org_snapshots').execute();
                await db.deleteFrom('secret_references').execute();
                await db.deleteFrom('provider_auth_states').execute();
                await db.deleteFrom('provider_auth_flows').execute();
                await db.deleteFrom('provider_model_catalog').execute();
                await db.deleteFrom('provider_discovery_snapshots').execute();
                await db.deleteFrom('permission_policy_overrides').execute();
                await db.deleteFrom('marketplace_packages').execute();
                await db.deleteFrom('provider_models').execute();
                await db.deleteFrom('providers').execute();
                await db.deleteFrom('tools_catalog').execute();
                await db.deleteFrom('mcp_servers').execute();

                reseedRuntimeData();
                await removeSecretsByReferences(secretRefs.map((secretRef) => secretRef.secretKeyRef));
            }

            appLog.info({
                tag: 'runtime.reset',
                message: 'Completed full runtime reset.',
                target: input.target,
                dryRun,
                applied: !dryRun,
                durationMs: Date.now() - startedAt,
                secretRefsRemoved: dryRun ? 0 : secretRefs.length,
                counts,
            });

            return {
                dryRun,
                target: input.target,
                applied: !dryRun,
                counts,
            };
        } catch (error) {
            appLog.error({
                tag: 'runtime.reset',
                message: 'Runtime reset failed.',
                target: input.target,
                dryRun,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}

export const runtimeResetService: RuntimeResetService = new RuntimeResetServiceImpl();
