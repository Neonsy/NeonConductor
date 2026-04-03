import { planPhaseStore, planPhaseVerificationStore, planStore } from '@/app/backend/persistence/stores';
import type {
    EntityId,
    PlanRecordView,
    PlanStartPhaseReplanInput,
    PlanVerifyPhaseInput,
} from '@/app/backend/runtime/contracts';
import { errPlan, okPlan, type PlanServiceError } from '@/app/backend/runtime/services/plan/errors';
import {
    appendPlanPhaseReplanStartedEvent,
    appendPlanPhaseVerificationRecordedEvent,
} from '@/app/backend/runtime/services/plan/events';
import { buildPhaseReplanScaffold } from '@/app/backend/runtime/services/plan/phaseScaffold';
import { requirePlanView } from '@/app/backend/runtime/services/plan/views';

import type { Result } from 'neverthrow';

export async function verifyPhase(
    input: PlanVerifyPhaseInput
): Promise<Result<{ found: false } | { found: true; plan: PlanRecordView }, PlanServiceError>> {
    const plan = await planStore.getById(input.profileId, input.planId);
    if (!plan) {
        return okPlan({ found: false });
    }
    if (plan.planningDepth !== 'advanced') {
        return errPlan('invalid_state', 'Phase verification is only available on advanced plans.');
    }

    const phase = await planPhaseStore.getById(input.phaseId);
    if (!phase || phase.planId !== input.planId) {
        return errPlan('revision_conflict', 'Cannot verify a phase that does not belong to this plan.');
    }
    if (phase.status !== 'implemented' || phase.implementedRevisionId !== input.phaseRevisionId) {
        return errPlan('invalid_state', 'Only an implemented phase revision can be verified.');
    }
    if (input.outcome === 'passed' && input.discrepancies.length > 0) {
        return errPlan('invalid_state', 'Passed verification cannot include discrepancy entries.');
    }
    if (input.outcome === 'failed' && input.discrepancies.length === 0) {
        return errPlan('invalid_state', 'Failed verification requires at least one discrepancy.');
    }

    const created = await planPhaseVerificationStore.createVerification({
        planId: input.planId,
        planPhaseId: input.phaseId,
        planPhaseRevisionId: input.phaseRevisionId,
        outcome: input.outcome,
        summaryMarkdown: input.summaryMarkdown,
        discrepancies: input.discrepancies,
    });
    if (!created) {
        return errPlan('revision_conflict', 'Unable to persist the requested phase verification.');
    }

    const verificationView = await planPhaseVerificationStore.getViewById({
        verificationId: created.id,
    });
    if (!verificationView) {
        return errPlan('revision_conflict', 'Unable to read the persisted phase verification.');
    }

    await appendPlanPhaseVerificationRecordedEvent({
        profileId: input.profileId,
        planId: input.planId,
        phaseId: phase.id as EntityId<'pph'>,
        phaseRevisionId: input.phaseRevisionId as EntityId<'pprv'>,
        phaseOutlineId: phase.phaseOutlineId,
        phaseSequence: phase.phaseSequence,
        phaseTitle: phase.title,
        phaseRevisionNumber: phase.implementedRevisionNumber ?? phase.currentRevisionNumber,
        verificationId: created.id as EntityId<'ppv'>,
        outcome: created.outcome,
        discrepancyCount: verificationView.discrepancies.length,
        variantId: plan.currentVariantId,
    });

    const projection = await planStore.getProjectionById(input.profileId, input.planId);
    if (!projection) {
        return errPlan('revision_conflict', 'Unable to read the verified phase state.');
    }

    return okPlan({
        found: true,
        plan: requirePlanView(projection, 'plan.verifyPhase'),
    });
}

export async function startPhaseReplan(
    input: PlanStartPhaseReplanInput
): Promise<Result<{ found: false } | { found: true; plan: PlanRecordView }, PlanServiceError>> {
    const plan = await planStore.getById(input.profileId, input.planId);
    if (!plan) {
        return okPlan({ found: false });
    }
    if (plan.planningDepth !== 'advanced') {
        return errPlan('invalid_state', 'Phase replanning is only available on advanced plans.');
    }

    const phase = await planPhaseStore.getById(input.phaseId);
    if (!phase || phase.planId !== input.planId) {
        return errPlan('revision_conflict', 'Cannot replan a phase that does not belong to this plan.');
    }
    if (phase.status !== 'implemented' || !phase.implementedRevisionId) {
        return errPlan('invalid_state', 'Only an implemented phase can start a replan draft.');
    }

    const verificationView = await planPhaseVerificationStore.getViewById({
        verificationId: input.verificationId,
    });
    if (
        !verificationView ||
        verificationView.verification.planPhaseId !== input.phaseId ||
        verificationView.verification.planPhaseRevisionId !== phase.implementedRevisionId ||
        verificationView.verification.outcome !== 'failed'
    ) {
        return errPlan('revision_conflict', 'Phase replan requires the latest failed verification for the implemented revision.');
    }

    const evidenceAttachments = await planStore.listEvidenceAttachments(plan.currentRevisionId);
    const scaffold = buildPhaseReplanScaffold({
        phase,
        verification: {
            ...verificationView.verification,
            discrepancies: verificationView.discrepancies,
        },
        evidenceAttachments,
    });

    const replanned = await planPhaseStore.startPhaseReplan({
        planId: input.planId,
        planPhaseId: input.phaseId,
        sourcePhaseRevisionId: phase.implementedRevisionId,
        sourceVerificationId: input.verificationId,
        summaryMarkdown: scaffold.summaryMarkdown,
        itemDescriptions: scaffold.itemDescriptions,
    });
    if (!replanned) {
        return errPlan('revision_conflict', 'Unable to create the requested phase replan draft.');
    }

    await appendPlanPhaseReplanStartedEvent({
        profileId: input.profileId,
        planId: input.planId,
        phaseId: replanned.id as EntityId<'pph'>,
        phaseRevisionId: replanned.currentRevisionId as EntityId<'pprv'>,
        phaseOutlineId: replanned.phaseOutlineId,
        phaseSequence: replanned.phaseSequence,
        phaseTitle: replanned.title,
        phaseRevisionNumber: replanned.currentRevisionNumber,
        sourceVerificationId: input.verificationId as EntityId<'ppv'>,
        variantId: plan.currentVariantId,
    });

    const projection = await planStore.getProjectionById(input.profileId, input.planId);
    if (!projection) {
        return errPlan('revision_conflict', 'Unable to read the replanned phase state.');
    }

    return okPlan({
        found: true,
        plan: requirePlanView(projection, 'plan.startPhaseReplan'),
    });
}
