import { permissionPolicyOverrideStore, permissionStore, toolStore } from '@/app/backend/persistence/stores';
import {
    permissionDecisionInputSchema,
    permissionGetEffectivePolicyInputSchema,
    permissionRequestInputSchema,
    permissionSetProfileOverrideInputSchema,
    permissionSetWorkspaceOverrideInputSchema,
} from '@/app/backend/runtime/contracts';
import { resolveEffectivePermissionPolicy } from '@/app/backend/runtime/services/permissions/policyResolver';
import { runtimeStatusEvent, runtimeUpsertEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const permissionRouter = router({
    request: publicProcedure.input(permissionRequestInputSchema).mutation(async ({ input }) => {
        const record = await permissionStore.create(input);
        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'permission',
            domain: 'permission',
            entityId: record.id,
            eventType: 'permission.requested',
            payload: {
                request: record,
            },
            })
        );

        return { request: record };
    }),
    listPending: publicProcedure.query(async () => {
        return { requests: await permissionStore.listPending() };
    }),
    getEffectivePolicy: publicProcedure.input(permissionGetEffectivePolicyInputSchema).query(async ({ input }) => {
        const tools = await toolStore.list();
        const toolId = input.resource.startsWith('tool:') ? input.resource.slice('tool:'.length) : null;
        const tool = toolId ? tools.find((item) => item.id === toolId) : null;
        const defaultPolicy = tool?.permissionPolicy ?? 'deny';

        const resolved = await resolveEffectivePermissionPolicy({
            profileId: input.profileId,
            resource: input.resource,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            toolDefaultPolicy: defaultPolicy,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });

        return {
            resource: input.resource,
            policy: resolved.policy,
            source: resolved.source,
            defaultPolicy,
        };
    }),
    setProfileOverride: publicProcedure.input(permissionSetProfileOverrideInputSchema).mutation(async ({ input }) => {
        const override = await permissionPolicyOverrideStore.upsert(
            input.profileId,
            permissionPolicyOverrideStore.toProfileScopeKey(),
            input.resource,
            input.policy
        );
        await runtimeEventLogService.append(
            runtimeUpsertEvent({
            entityType: 'permission',
            domain: 'permission',
            entityId: input.resource,
            eventType: 'permission.override.profile.set',
            payload: {
                profileId: input.profileId,
                resource: input.resource,
                policy: input.policy,
            },
            })
        );

        return {
            override,
        };
    }),
    setWorkspaceOverride: publicProcedure
        .input(permissionSetWorkspaceOverrideInputSchema)
        .mutation(async ({ input }) => {
            const override = await permissionPolicyOverrideStore.upsert(
                input.profileId,
                permissionPolicyOverrideStore.toWorkspaceScopeKey(input.workspaceFingerprint),
                input.resource,
                input.policy
            );
            await runtimeEventLogService.append(
                runtimeUpsertEvent({
                entityType: 'permission',
                domain: 'permission',
                entityId: input.resource,
                eventType: 'permission.override.workspace.set',
                payload: {
                    profileId: input.profileId,
                    workspaceFingerprint: input.workspaceFingerprint,
                    resource: input.resource,
                    policy: input.policy,
                },
                })
            );

            return {
                override,
            };
        }),
    grant: publicProcedure.input(permissionDecisionInputSchema).mutation(async ({ input }) => {
        const record = await permissionStore.getById(input.requestId);
        if (!record) {
            return { updated: false as const, reason: 'not_found' as const };
        }
        if (record.decision === 'granted') {
            return { updated: false as const, reason: 'already_granted' as const, request: record };
        }

        const updatedRecord = await permissionStore.setDecision(input.requestId, 'granted');
        if (!updatedRecord) {
            return { updated: false as const, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'permission',
            domain: 'permission',
            entityId: updatedRecord.id,
            eventType: 'permission.granted',
            payload: {
                request: updatedRecord,
            },
            })
        );

        return { updated: true as const, reason: null, request: updatedRecord };
    }),
    deny: publicProcedure.input(permissionDecisionInputSchema).mutation(async ({ input }) => {
        const record = await permissionStore.getById(input.requestId);
        if (!record) {
            return { updated: false as const, reason: 'not_found' as const };
        }
        if (record.decision === 'denied') {
            return { updated: false as const, reason: 'already_denied' as const, request: record };
        }

        const updatedRecord = await permissionStore.setDecision(input.requestId, 'denied');
        if (!updatedRecord) {
            return { updated: false as const, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'permission',
            domain: 'permission',
            entityId: updatedRecord.id,
            eventType: 'permission.denied',
            payload: {
                request: updatedRecord,
            },
            })
        );

        return { updated: true as const, reason: null, request: updatedRecord };
    }),
});
