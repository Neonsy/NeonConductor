import { MarkdownContent } from '@/web/components/content/markdown/markdownContent';
import type {
    ModeExecutionPhaseDraftState,
    ModeExecutionPhasePanelMode,
    ModeExecutionPhaseVerificationDraftState,
    ModeExecutionPlanPhaseVerificationView,
    ModeExecutionPlanPhaseRecordView,
    ModeExecutionPlanPhaseState,
} from '@/web/components/conversation/panels/modeExecutionPanelState';
import { Button } from '@/web/components/ui/button';

type VerificationOutcome = ModeExecutionPlanPhaseVerificationView['outcome'];

function readPhaseStatusLabel(status: ModeExecutionPlanPhaseRecordView['status']): string {
    switch (status) {
        case 'not_started':
            return 'Not started';
        case 'draft':
            return 'Draft';
        case 'approved':
            return 'Approved';
        case 'implementing':
            return 'Implementing';
        case 'implemented':
            return 'Implemented';
        case 'cancelled':
            return 'Cancelled';
    }
}

function readPhaseStatusToneClass(status: ModeExecutionPlanPhaseRecordView['status']): string {
    switch (status) {
        case 'approved':
        case 'implemented':
            return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
        case 'implementing':
            return 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-300';
        case 'draft':
            return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300';
        case 'cancelled':
            return 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300';
        case 'not_started':
            return 'border-border bg-background text-foreground';
    }
}

function readPhaseItemStatusLabel(status: ModeExecutionPlanPhaseRecordView['items'][number]['status']): string {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'running':
            return 'Running';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'aborted':
            return 'Aborted';
    }
}

function readVerificationOutcomeLabel(
    outcome: VerificationOutcome
): string {
    return outcome === 'passed' ? 'Passed' : 'Failed';
}

function readVerificationOutcomeToneClass(
    outcome: VerificationOutcome
): string {
    return outcome === 'passed'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
        : 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300';
}

function readVerificationStatusToneClass(
    status: ModeExecutionPlanPhaseRecordView['verificationStatus']
): string {
    switch (status) {
        case 'passed':
            return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
        case 'failed':
            return 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300';
        case 'pending':
            return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300';
        case 'not_applicable':
            return 'border-border bg-background text-foreground';
        default:
            return 'border-border bg-background text-foreground';
    }
}

interface PlanPhaseDetailSectionProps {
    phaseState: ModeExecutionPlanPhaseState | undefined;
    phaseDraftState: ModeExecutionPhaseDraftState | undefined;
    phaseVerificationDraftState: ModeExecutionPhaseVerificationDraftState | undefined;
    phasePanelMode: ModeExecutionPhasePanelMode | undefined;
    isPlanMutating: boolean;
    onExpandNextPhase?: () => void;
    onEnterPhaseEditMode?: () => void;
    onEnterPhaseVerificationMode?: () => void;
    onPhaseSummaryDraftChange?: (next: string) => void;
    onPhaseItemsDraftChange?: (next: string) => void;
    onSavePhaseDraft?: () => void;
    onDiscardPhaseEdits?: () => void;
    onVerificationOutcomeChange?: (next: ModeExecutionPhaseVerificationDraftState['outcome']) => void;
    onVerificationSummaryDraftChange?: (next: string) => void;
    onVerificationDiscrepancyTitleChange?: (discrepancyId: string, next: string) => void;
    onVerificationDiscrepancyDetailsChange?: (discrepancyId: string, next: string) => void;
    onAddVerificationDiscrepancy?: () => void;
    onRemoveVerificationDiscrepancy?: (discrepancyId: string) => void;
    onSavePhaseVerification?: () => void;
    onDiscardPhaseVerificationEdits?: () => void;
    onApprovePhase?: () => void;
    onImplementPhase?: () => void;
    onCancelPhase?: () => void;
    onStartPhaseReplan?: () => void;
}

export function PlanPhaseDetailSection({
    phaseState,
    phaseDraftState,
    phaseVerificationDraftState,
    phasePanelMode,
    isPlanMutating,
    onExpandNextPhase,
    onEnterPhaseEditMode,
    onEnterPhaseVerificationMode,
    onPhaseSummaryDraftChange,
    onPhaseItemsDraftChange,
    onSavePhaseDraft,
    onDiscardPhaseEdits,
    onVerificationOutcomeChange,
    onVerificationSummaryDraftChange,
    onVerificationDiscrepancyTitleChange,
    onVerificationDiscrepancyDetailsChange,
    onAddVerificationDiscrepancy,
    onRemoveVerificationDiscrepancy,
    onSavePhaseVerification,
    onDiscardPhaseVerificationEdits,
    onApprovePhase,
    onImplementPhase,
    onCancelPhase,
    onStartPhaseReplan,
}: PlanPhaseDetailSectionProps) {
    const currentPhase = phaseState?.currentPhase;
    const nextRoadmapPhase = phaseState?.nextExpandablePhaseOutlineId
        ? phaseState.roadmapPhases.find((phase) => phase.id === phaseState.nextExpandablePhaseOutlineId)
        : undefined;
    const canExpandNextPhase = Boolean(phaseState?.canExpandNextPhase);
    const isEditing = phasePanelMode === 'edit' && Boolean(currentPhase) && Boolean(phaseDraftState);
    const isVerifying = phasePanelMode === 'verification' && Boolean(currentPhase) && Boolean(phaseVerificationDraftState);
    const canRevisePhase = currentPhase
        ? currentPhase.status !== 'not_started' &&
          currentPhase.status !== 'implemented' &&
          currentPhase.status !== 'cancelled'
        : false;
    const canApprovePhase = currentPhase?.status === 'draft';
    const canImplementPhase = currentPhase?.status === 'approved';
    const canCancelPhase =
        currentPhase?.status === 'draft' ||
        currentPhase?.status === 'approved' ||
        currentPhase?.status === 'implementing';
    const canStartVerification = currentPhase?.canStartVerification ?? currentPhase?.status === 'implemented';
    const canStartVerificationAction =
        currentPhase?.status === 'implemented' &&
        (currentPhase.canStartVerification ?? currentPhase.verificationStatus === undefined);
    const canStartPhaseReplan = currentPhase?.canStartReplan ?? currentPhase?.verificationStatus === 'failed';
    const verificationHistory = currentPhase?.verifications ?? (currentPhase?.latestVerification ? [currentPhase.latestVerification] : []);

    return (
        <section className='border-border/70 bg-background/80 space-y-3 rounded-2xl border p-3 shadow-sm'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1'>
                    <p className='text-sm font-semibold'>Current Phase Detail</p>
                    <p className='text-muted-foreground text-xs'>
                        The approved roadmap stays intact while one detailed phase is expanded, approved, and
                        implemented at a time.
                    </p>
                </div>
                {canExpandNextPhase ? (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isPlanMutating || !onExpandNextPhase}
                        onClick={() => {
                            onExpandNextPhase?.();
                        }}>
                        Expand Next Phase
                    </Button>
                ) : null}
            </div>

            {currentPhase ? (
                <div className='space-y-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${readPhaseStatusToneClass(currentPhase.status)}`}>
                            {readPhaseStatusLabel(currentPhase.status)}
                        </span>
                        <span className='border-border/70 bg-background rounded-full border px-2 py-0.5 text-[11px]'>
                            Phase {String(currentPhase.phaseSequence)}
                        </span>
                        <span className='border-border/70 bg-background rounded-full border px-2 py-0.5 text-[11px]'>
                            Revision {String(currentPhase.currentRevisionNumber)}
                        </span>
                        {currentPhase.verificationStatus ? (
                            <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${readVerificationStatusToneClass(
                                    currentPhase.verificationStatus
                                )}`}>
                                {currentPhase.verificationStatus === 'passed'
                                    ? 'Verified'
                                    : currentPhase.verificationStatus === 'failed'
                                      ? 'Verification failed'
                                      : currentPhase.verificationStatus === 'pending'
                                        ? 'Verification pending'
                                        : 'Verification not applicable'}
                            </span>
                        ) : null}
                        <span className='text-muted-foreground text-[11px]'>{currentPhase.title}</span>
                    </div>

                    <div className='border-border bg-background rounded-xl border p-3'>
                        <div className='space-y-1'>
                            <p className='text-xs font-semibold'>{currentPhase.title}</p>
                            <p className='text-muted-foreground text-[11px]'>
                                Anchored to roadmap phase {String(currentPhase.phaseSequence)}
                                {nextRoadmapPhase ? ` · ${nextRoadmapPhase.title}` : ''}
                            </p>
                        </div>
                        <div className='mt-3 space-y-3 text-xs'>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-[11px] font-medium uppercase'>Goal</p>
                                <MarkdownContent markdown={currentPhase.goalMarkdown} className='space-y-2' />
                            </div>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-[11px] font-medium uppercase'>
                                    Exit criteria
                                </p>
                                <MarkdownContent markdown={currentPhase.exitCriteriaMarkdown} className='space-y-2' />
                            </div>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-[11px] font-medium uppercase'>Summary</p>
                                <MarkdownContent markdown={currentPhase.summaryMarkdown} className='space-y-2' />
                            </div>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-[11px] font-medium uppercase'>
                                    Ordered items
                                </p>
                                <div className='space-y-2'>
                                    {currentPhase.items.map((item) => (
                                        <article
                                            key={item.id}
                                            className='border-border/70 bg-background rounded-xl border px-3 py-2 text-xs'>
                                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                                <p className='font-medium'>
                                                    {String(item.sequence)}. {item.description}
                                                </p>
                                                <span className='border-border/70 rounded-full border px-2 py-0.5 text-[11px]'>
                                                    {readPhaseItemStatusLabel(item.status)}
                                                </span>
                                            </div>
                                            {item.runId || item.errorMessage ? (
                                                <div className='text-muted-foreground mt-2 flex flex-wrap gap-2 text-[11px]'>
                                                    {item.runId ? (
                                                        <span className='rounded-full border px-2 py-0.5'>
                                                            Run {item.runId}
                                                        </span>
                                                    ) : null}
                                                    {item.errorMessage ? (
                                                        <span className='rounded-full border px-2 py-0.5'>
                                                            {item.errorMessage}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {(currentPhase.status === 'implemented' ||
                        verificationHistory.length > 0 ||
                        isVerifying ||
                        canStartVerification) ? (
                        <div className='border-border/70 bg-background/90 space-y-3 rounded-xl border p-3'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div className='space-y-1'>
                                    <p className='text-sm font-semibold'>Verification</p>
                                    <p className='text-muted-foreground text-xs'>
                                        Manually verify the implemented phase before the next roadmap phase opens.
                                    </p>
                                </div>
                                {!isVerifying ? (
                                    <div className='flex flex-wrap gap-2'>
                                        {canStartVerificationAction ? (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                disabled={isPlanMutating || !onEnterPhaseVerificationMode}
                                                onClick={() => {
                                                    onEnterPhaseVerificationMode?.();
                                                }}>
                                                Start Verification
                                            </Button>
                                        ) : null}
                                        {canStartPhaseReplan ? (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='ghost'
                                                disabled={isPlanMutating || !onStartPhaseReplan}
                                                onClick={() => {
                                                    onStartPhaseReplan?.();
                                                }}>
                                                Start Phase Replan
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <div className='space-y-2'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                            currentPhase.verificationStatus === 'passed'
                                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                                : currentPhase.verificationStatus === 'failed'
                                                  ? 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300'
                                                  : 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                        }`}>
                                        {currentPhase.verificationStatus === 'passed'
                                            ? 'Verified'
                                            : currentPhase.verificationStatus === 'failed'
                                              ? 'Verification failed'
                                              : 'Verification pending'}
                                    </span>
                                    {currentPhase.implementedRevisionNumber ? (
                                        <span className='border-border/70 bg-background rounded-full border px-2 py-0.5 text-[11px]'>
                                            Implemented revision {String(currentPhase.implementedRevisionNumber)}
                                        </span>
                                    ) : null}
                                </div>

                                {currentPhase.verificationStatus === 'passed' ? (
                                    <p className='text-emerald-700 dark:text-emerald-300 text-xs'>
                                        This phase has been verified. The next roadmap phase can now open when no other
                                        detailed phase is active.
                                    </p>
                                ) : currentPhase.verificationStatus === 'failed' ? (
                                    <p className='text-red-700 dark:text-red-300 text-xs'>
                                        Verification failed. Replan this phase before advancing the roadmap.
                                    </p>
                                ) : currentPhase.status === 'implemented' ? (
                                    <p className='text-amber-700 dark:text-amber-300 text-xs'>
                                        This implemented phase still needs manual verification before the roadmap can
                                        expand further.
                                    </p>
                                ) : null}
                            </div>

                            {verificationHistory.length > 0 ? (
                                <div className='space-y-2'>
                                    <p className='text-muted-foreground text-[11px] font-medium uppercase'>
                                        Verification history
                                    </p>
                                    <div className='space-y-2'>
                                        {verificationHistory.map((verification) => (
                                            <article
                                                key={verification.id}
                                                className='border-border/70 bg-background rounded-xl border p-3 text-xs'>
                                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                                    <div className='space-y-1'>
                                                        <div className='flex flex-wrap items-center gap-2'>
                                                            <span
                                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${readVerificationOutcomeToneClass(verification.outcome)}`}>
                                                                {readVerificationOutcomeLabel(verification.outcome)}
                                                            </span>
                                                            <span className='border-border/70 rounded-full border px-2 py-0.5 text-[11px]'>
                                                                {verification.createdAt}
                                                            </span>
                                                        </div>
                                                        <p className='text-muted-foreground text-[11px]'>
                                                            Verification {verification.id}
                                                        </p>
                                                    </div>
                                                    {verification.outcome === 'failed' && canStartPhaseReplan ? (
                                                        <Button
                                                            type='button'
                                                            size='sm'
                                                            variant='outline'
                                                            disabled={isPlanMutating || !onStartPhaseReplan}
                                                            onClick={() => {
                                                                onStartPhaseReplan?.();
                                                            }}>
                                                            Start Phase Replan
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                <div className='mt-3 space-y-2'>
                                                    <MarkdownContent markdown={verification.summaryMarkdown} className='space-y-2' />
                                                    {verification.discrepancies.length > 0 ? (
                                                        <div className='space-y-2'>
                                                            <p className='text-muted-foreground text-[11px] font-medium uppercase'>
                                                                Discrepancies
                                                            </p>
                                                            <div className='space-y-2'>
                                                                {verification.discrepancies.map((discrepancy) => (
                                                                    <article
                                                                        key={discrepancy.id}
                                                                        className='border-border/70 bg-background/80 rounded-lg border p-2'>
                                                                        <p className='font-medium'>
                                                                            {String(discrepancy.sequence)}. {discrepancy.title}
                                                                        </p>
                                                                        <MarkdownContent
                                                                            markdown={discrepancy.detailsMarkdown}
                                                                            className='mt-1 space-y-2'
                                                                        />
                                                                    </article>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {isVerifying && phaseVerificationDraftState ? (
                                <div className='border-border/70 bg-background/90 space-y-3 rounded-xl border p-3'>
                                    <div className='space-y-1'>
                                        <p className='text-sm font-semibold'>Start Verification</p>
                                        <p className='text-muted-foreground text-xs'>
                                            Record whether the implemented phase matched the approved intent.
                                        </p>
                                    </div>

                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant={phaseVerificationDraftState.outcome === 'passed' ? 'default' : 'outline'}
                                            disabled={isPlanMutating}
                                            onClick={() => {
                                                onVerificationOutcomeChange?.('passed');
                                            }}>
                                            Passed
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant={phaseVerificationDraftState.outcome === 'failed' ? 'default' : 'outline'}
                                            disabled={isPlanMutating}
                                            onClick={() => {
                                                onVerificationOutcomeChange?.('failed');
                                            }}>
                                            Failed
                                        </Button>
                                    </div>

                                    <div className='space-y-1'>
                                        <p className='text-xs font-medium'>Verification summary</p>
                                        <textarea
                                            rows={6}
                                            className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                            value={phaseVerificationDraftState.summaryDraft}
                                            disabled={isPlanMutating}
                                            onChange={(event) => {
                                                onVerificationSummaryDraftChange?.(event.target.value);
                                            }}
                                        />
                                    </div>

                                    {phaseVerificationDraftState.outcome === 'failed' ? (
                                        <div className='space-y-2'>
                                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                                <div className='space-y-1'>
                                                    <p className='text-xs font-medium'>Discrepancies</p>
                                                    <p className='text-muted-foreground text-[11px]'>
                                                        Record the concrete mismatches that should drive a replan.
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    variant='outline'
                                                    disabled={isPlanMutating || !onAddVerificationDiscrepancy}
                                                    onClick={() => {
                                                        onAddVerificationDiscrepancy?.();
                                                    }}>
                                                    Add discrepancy
                                                </Button>
                                            </div>

                                            <div className='space-y-2'>
                                                {phaseVerificationDraftState.discrepanciesDraft.length > 0 ? (
                                                    phaseVerificationDraftState.discrepanciesDraft.map((discrepancy) => (
                                                        <article
                                                            key={discrepancy.id}
                                                            className='border-border/70 bg-background rounded-xl border p-3 text-xs'>
                                                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                                                <p className='font-medium'>Discrepancy</p>
                                                                <Button
                                                                    type='button'
                                                                    size='sm'
                                                                    variant='ghost'
                                                                    disabled={isPlanMutating || !onRemoveVerificationDiscrepancy}
                                                                    onClick={() => {
                                                                        onRemoveVerificationDiscrepancy?.(discrepancy.id);
                                                                    }}>
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                            <div className='mt-2 space-y-2'>
                                                                <input
                                                                    className='border-border bg-background h-8 w-full rounded-md border px-2 text-xs'
                                                                    value={discrepancy.title}
                                                                    disabled={isPlanMutating}
                                                                    placeholder='Mismatch title'
                                                                    onChange={(event) => {
                                                                        onVerificationDiscrepancyTitleChange?.(
                                                                            discrepancy.id,
                                                                            event.target.value
                                                                        );
                                                                    }}
                                                                />
                                                                <textarea
                                                                    rows={4}
                                                                    className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                                                    value={discrepancy.detailsMarkdown}
                                                                    disabled={isPlanMutating}
                                                                    placeholder='Describe the mismatch in detail'
                                                                    onChange={(event) => {
                                                                        onVerificationDiscrepancyDetailsChange?.(
                                                                            discrepancy.id,
                                                                            event.target.value
                                                                        );
                                                                    }}
                                                                />
                                                            </div>
                                                        </article>
                                                    ))
                                                ) : (
                                                    <p className='text-muted-foreground text-xs'>
                                                        No discrepancies recorded yet.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            disabled={isPlanMutating || !onSavePhaseVerification}
                                            onClick={() => {
                                                onSavePhaseVerification?.();
                                            }}>
                                            Save Verification
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='ghost'
                                            disabled={isPlanMutating || !onDiscardPhaseVerificationEdits}
                                            onClick={() => {
                                                onDiscardPhaseVerificationEdits?.();
                                            }}>
                                            Discard Verification
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {isEditing && phaseDraftState ? (
                        <div className='border-border/70 bg-background/90 space-y-3 rounded-xl border p-3'>
                            <div className='space-y-1'>
                                <p className='text-sm font-semibold'>Edit Phase Detail</p>
                                <p className='text-muted-foreground text-xs'>
                                    Revise this phase without reopening the approved roadmap.
                                </p>
                            </div>
                            <div className='space-y-1'>
                                <p className='text-xs font-medium'>Phase Summary</p>
                                <textarea
                                    rows={6}
                                    className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                    value={phaseDraftState.summaryDraft}
                                    disabled={isPlanMutating}
                                    onChange={(event) => {
                                        onPhaseSummaryDraftChange?.(event.target.value);
                                    }}
                                />
                            </div>
                            <div className='space-y-1'>
                                <p className='text-xs font-medium'>Ordered Items (one per line)</p>
                                <textarea
                                    rows={6}
                                    className='border-border bg-background w-full rounded-md border p-2 text-xs'
                                    value={phaseDraftState.itemsDraft}
                                    disabled={isPlanMutating}
                                    onChange={(event) => {
                                        onPhaseItemsDraftChange?.(event.target.value);
                                    }}
                                />
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={isPlanMutating || !onSavePhaseDraft}
                                    onClick={() => {
                                        onSavePhaseDraft?.();
                                    }}>
                                    Save Phase Draft
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='ghost'
                                    disabled={isPlanMutating || !onDiscardPhaseEdits}
                                    onClick={() => {
                                        onDiscardPhaseEdits?.();
                                    }}>
                                    Discard Edits
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {!isEditing ? (
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={isPlanMutating || !onEnterPhaseEditMode || !canRevisePhase}
                                onClick={() => {
                                    onEnterPhaseEditMode?.();
                                }}>
                                Revise
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={isPlanMutating || !onApprovePhase || !canApprovePhase}
                                onClick={() => {
                                    onApprovePhase?.();
                                }}>
                                Approve
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                disabled={isPlanMutating || !onImplementPhase || !canImplementPhase}
                                onClick={() => {
                                    onImplementPhase?.();
                                }}>
                                Implement Phase
                            </Button>
                            <Button
                                type='button'
                                size='sm'
                                variant='ghost'
                                disabled={isPlanMutating || !onCancelPhase || !canCancelPhase}
                                onClick={() => {
                                    onCancelPhase?.();
                                }}>
                                Cancel
                            </Button>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className='border-border/70 bg-background rounded-xl border p-3 text-xs'>
                    <p className='font-medium'>No detailed phase is open yet.</p>
                    <p className='text-muted-foreground mt-1'>
                        Expand the next roadmap phase to create the first phase detail lane.
                    </p>
                    {nextRoadmapPhase ? (
                        <p className='text-muted-foreground mt-2 text-[11px]'>
                            Next eligible roadmap phase: <span className='font-medium'>{nextRoadmapPhase.title}</span>
                        </p>
                    ) : null}
                </div>
            )}
        </section>
    );
}
