import { ChangedFilesSection } from '@/web/components/conversation/panels/diffCheckpointPanel/changedFilesSection';
import { CheckpointMaintenanceActions } from '@/web/components/conversation/panels/diffCheckpointPanel/checkpointMaintenanceActions';
import { CheckpointMilestoneActions } from '@/web/components/conversation/panels/diffCheckpointPanel/checkpointMilestoneActions';
import { DiffPatchPreviewPanel } from '@/web/components/conversation/panels/diffCheckpointPanel/diffPatchPreviewPanel';
import {
    useDiffCheckpointPanelController,
    type DiffCheckpointPanelProps,
} from '@/web/components/conversation/panels/diffCheckpointPanel/useDiffCheckpointPanelController';

export function DiffCheckpointPanel(input: DiffCheckpointPanelProps) {
    const controller = useDiffCheckpointPanelController(input);

    return (
        <section className='border-border bg-card/80 mt-3 rounded-2xl border p-4 shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold'>Changes and Checkpoints</p>
                    <p className='text-muted-foreground text-xs'>
                        {input.selectedRunId
                            ? `Run ${input.selectedRunId}`
                            : 'Select a run to inspect code and workspace changes'}
                        {input.selectedSessionId ? ` · ${String(input.checkpoints.length)} checkpoints` : ''}
                    </p>
                </div>
            </div>

            <CheckpointMilestoneActions
                selectedRunId={input.selectedRunId}
                disabled={input.disabled}
                milestoneTitle={controller.milestoneTitle}
                feedbackMessage={controller.feedbackMessage}
                isSavingMilestone={controller.isSavingMilestone}
                onMilestoneTitleChange={controller.onMilestoneTitleChange}
                onSaveMilestone={controller.onSaveMilestone}
            />

            {controller.selectedDiff ? (
                <div className='mt-3 grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]'>
                    <div className='space-y-3'>
                        {controller.changedFilesSectionProps ? (
                            <ChangedFilesSection {...controller.changedFilesSectionProps} />
                        ) : null}
                        <CheckpointMaintenanceActions {...controller.maintenanceActionsProps} />
                    </div>

                    <DiffPatchPreviewPanel {...controller.diffPatchPreviewProps} />
                </div>
            ) : (
                <DiffPatchPreviewPanel {...controller.diffPatchPreviewProps} />
            )}
        </section>
    );
}
