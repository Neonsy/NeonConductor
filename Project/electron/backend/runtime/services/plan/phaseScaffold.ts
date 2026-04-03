import type {
    PlanEvidenceAttachmentRecord,
    PlanItemRecord,
    PlanPhaseRecord,
    PlanRecord,
} from '@/app/backend/persistence/types';
import type {
    PlanAdvancedSnapshotView,
    PlanPhaseOutlineInput,
    PlanPhaseVerificationView,
} from '@/app/backend/runtime/contracts';

export interface PlanPhaseScaffold {
    summaryMarkdown: string;
    itemDescriptions: string[];
}

function buildPhaseScaffoldItems(input: {
    phaseOutline: PlanPhaseOutlineInput;
    planItems: PlanItemRecord[];
    evidenceAttachments: PlanEvidenceAttachmentRecord[];
}): string[] {
    const descriptions: string[] = [
        `Align this phase with "${input.phaseOutline.title}".`,
        `Work through the stated goal: ${input.phaseOutline.goalMarkdown}`,
        `Verify the exit criteria: ${input.phaseOutline.exitCriteriaMarkdown}`,
    ];

    if (input.planItems.length > 0) {
        descriptions.push(
            `Reference the current plan roadmap item "${input.planItems[0]?.description ?? 'the current plan roadmap'}".`
        );
    }

    if (input.evidenceAttachments.length > 0) {
        descriptions.push(
            `Incorporate the most relevant evidence attachment "${input.evidenceAttachments[0]?.label ?? 'the most relevant evidence attachment'}".`
        );
    }

    return descriptions.slice(0, 4);
}

export function buildPhaseExpansionScaffold(input: {
    plan: PlanRecord;
    advancedSnapshot: PlanAdvancedSnapshotView;
    phaseOutline: PlanPhaseOutlineInput;
    planItems: PlanItemRecord[];
    evidenceAttachments: PlanEvidenceAttachmentRecord[];
}): PlanPhaseScaffold {
    const itemDescriptions = buildPhaseScaffoldItems({
        phaseOutline: input.phaseOutline,
        planItems: input.planItems,
        evidenceAttachments: input.evidenceAttachments,
    });

    return {
        summaryMarkdown: [
            `## ${input.phaseOutline.title}`,
            '',
            `This detailed phase expands the approved roadmap phase from the advanced plan.`,
            '',
            '### Goal',
            input.phaseOutline.goalMarkdown,
            '',
            '### Exit Criteria',
            input.phaseOutline.exitCriteriaMarkdown,
            '',
            '### Anchor',
            `- Master roadmap summary: ${input.plan.summaryMarkdown}`,
            `- Source prompt: ${input.plan.sourcePrompt}`,
            `- Approved roadmap phases: ${String(input.advancedSnapshot.phases.length)}`,
            `- Evidence attachments carried into this phase: ${String(input.evidenceAttachments.length)}`,
        ].join('\n'),
        itemDescriptions,
    };
}

export function buildPhaseReplanScaffold(input: {
    phase: PlanPhaseRecord;
    verification: PlanPhaseVerificationView;
    evidenceAttachments: PlanEvidenceAttachmentRecord[];
}): PlanPhaseScaffold {
    const discrepancyItems = input.verification.discrepancies.map(
        (discrepancy) => `Address discrepancy: ${discrepancy.title}`
    );
    const priorItems = input.phase.items.map((item) => item.description);

    return {
        summaryMarkdown: [
            `## ${input.phase.title} Replan`,
            '',
            'This replan draft preserves the previously implemented phase history while reopening the detailed work.',
            '',
            '### Prior Verification Summary',
            input.verification.summaryMarkdown,
            '',
            '### Discrepancies',
            ...(input.verification.discrepancies.length > 0
                ? input.verification.discrepancies.map(
                      (discrepancy, index) => `${String(index + 1)}. ${discrepancy.title}\n\n${discrepancy.detailsMarkdown}`
                  )
                : ['- No discrepancy details were recorded.']),
            '',
            '### Prior Implemented Summary',
            input.phase.summaryMarkdown,
            '',
            '### Carry-Forward Context',
            `- Existing detailed items: ${String(input.phase.items.length)}`,
            `- Evidence attachments on this revision: ${String(input.evidenceAttachments.length)}`,
        ].join('\n'),
        itemDescriptions: [...discrepancyItems, ...priorItems].slice(0, 6),
    };
}
