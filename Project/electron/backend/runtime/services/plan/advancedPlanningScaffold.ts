import type { PlanQuestionRecord, PlanRecord } from '@/app/backend/persistence/types';
import type {
    PlanAdvancedSnapshotInput,
    PlanPhaseOutlineInput,
    PlanPlanningDepth,
} from '@/app/backend/runtime/contracts';

function normalizeText(value: string): string {
    return value.trim();
}

function normalizePhaseOutline(input: PlanPhaseOutlineInput): PlanPhaseOutlineInput {
    return {
        id: normalizeText(input.id),
        sequence: input.sequence,
        title: normalizeText(input.title),
        goalMarkdown: normalizeText(input.goalMarkdown),
        exitCriteriaMarkdown: normalizeText(input.exitCriteriaMarkdown),
    };
}

export function normalizeAdvancedPlanningSnapshot(input: PlanAdvancedSnapshotInput): PlanAdvancedSnapshotInput {
    return {
        evidenceMarkdown: normalizeText(input.evidenceMarkdown),
        observationsMarkdown: normalizeText(input.observationsMarkdown),
        rootCauseMarkdown: normalizeText(input.rootCauseMarkdown),
        phases: input.phases.map((phase) => normalizePhaseOutline(phase)),
    };
}

function buildPhaseOutlines(input: {
    sourcePrompt: string;
    itemDescriptions: string[];
}): PlanPhaseOutlineInput[] {
    const normalizedItems = input.itemDescriptions.map((item) => normalizeText(item)).filter((item) => item.length > 0);
    const phaseTitles = [
        'Scope and evidence',
        'Implementation plan',
        'Verification and refinement',
        'Cleanup and handoff',
    ];
    const phaseCount = Math.min(4, Math.max(2, Math.ceil(Math.max(1, normalizedItems.length) / 2)));
    const itemsPerPhase = Math.max(1, Math.ceil(Math.max(1, normalizedItems.length) / phaseCount));

    return Array.from({ length: phaseCount }, (_, index) => {
        const phaseItems = normalizedItems.slice(index * itemsPerPhase, (index + 1) * itemsPerPhase);
        return {
            id: `phase_${String(index + 1)}`,
            sequence: index + 1,
            title: phaseTitles[index] ?? `Phase ${String(index + 1)}`,
            goalMarkdown:
                index === 0
                    ? [
                          'Ground the work in the original prompt and the current plan items.',
                          '',
                          `Source prompt: ${normalizeText(input.sourcePrompt)}`,
                          ...(phaseItems.length > 0
                              ? ['', 'Related items:', ...phaseItems.map((item) => `- ${item}`)]
                              : []),
                      ].join('\n')
                    : phaseItems.length > 0
                      ? ['Focus items:', ...phaseItems.map((item) => `- ${item}`)].join('\n')
                      : 'Continue the advanced planning work with the current revision context.',
            exitCriteriaMarkdown:
                phaseItems.length > 0
                    ? 'These items are complete when they are clearly scoped, internally consistent, and ready for implementation.'
                    : 'This phase is complete when the plan is ready for the next revision.',
        };
    });
}

export function buildAdvancedPlanningSnapshotScaffold(input: {
    sourcePrompt: string;
    questions: PlanQuestionRecord[];
    answers: Record<string, string>;
    status: PlanRecord['status'];
    currentRevisionNumber: number;
    planningDepth: PlanPlanningDepth;
    itemDescriptions: string[];
    approvedRevisionNumber?: number;
}): PlanAdvancedSnapshotInput {
    const answeredQuestions = input.questions.map((question) => {
        const answer = input.answers[question.id];
        return [
            `- id: ${question.id}`,
            `  category: ${question.category}`,
            `  required: ${question.required ? 'yes' : 'no'}`,
            `  question: ${question.question}`,
            `  answer: ${typeof answer === 'string' && answer.trim().length > 0 ? answer.trim() : '[unanswered]'}`,
        ].join('\n');
    });

    const evidenceSections = [
        '## Source Prompt',
        '',
        normalizeText(input.sourcePrompt),
        '',
        '## Intake Questions',
        '',
        answeredQuestions.length > 0 ? answeredQuestions.join('\n') : '- none',
        '',
        '## Plan State',
        '',
        `- status: ${input.status}`,
        `- planningDepth: ${input.planningDepth}`,
        `- currentRevision: ${String(input.currentRevisionNumber)}`,
        ...(input.approvedRevisionNumber !== undefined
            ? [`- approvedRevision: ${String(input.approvedRevisionNumber)}`]
            : []),
    ];

    return normalizeAdvancedPlanningSnapshot({
        evidenceMarkdown: evidenceSections.join('\n'),
        observationsMarkdown: [
            '## Observations',
            '',
            '- This scaffold is conservative and derived from the current plan data only.',
            '- The evidence section should stay the source of truth for known facts.',
            '- Use later revisions to refine the observations instead of over-committing now.',
        ].join('\n'),
        rootCauseMarkdown: [
            '## Root Cause',
            '',
            'The underlying cause is not established yet.',
            'Treat this section as a placeholder until the advanced planning lane gathers more evidence.',
        ].join('\n'),
        phases: buildPhaseOutlines({
            sourcePrompt: input.sourcePrompt,
            itemDescriptions: input.itemDescriptions,
        }),
    });
}
