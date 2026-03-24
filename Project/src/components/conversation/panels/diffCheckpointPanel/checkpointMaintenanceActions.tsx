import { CheckpointHistorySection, type CheckpointHistorySectionProps } from '@/web/components/conversation/panels/diffCheckpointPanel/checkpointHistorySection';

export interface CheckpointMaintenanceActionsProps extends CheckpointHistorySectionProps {}

export function CheckpointMaintenanceActions(input: CheckpointMaintenanceActionsProps) {
    return <CheckpointHistorySection {...input} />;
}
