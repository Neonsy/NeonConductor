import type { FlowLifecycleEvent } from '@/app/backend/runtime/contracts';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';

export async function appendFlowLifecycleEvent(event: FlowLifecycleEvent): Promise<void> {
    await runtimeEventLogService.append(
        runtimeStatusEvent({
            entityType: 'flow',
            domain: 'flow',
            entityId: event.flowInstanceId,
            eventType: event.kind,
            payload: event.payload as unknown as Record<string, unknown>,
        })
    );
}

export async function appendFlowLifecycleEvents(events: FlowLifecycleEvent[]): Promise<void> {
    for (const event of events) {
        await appendFlowLifecycleEvent(event);
    }
}
