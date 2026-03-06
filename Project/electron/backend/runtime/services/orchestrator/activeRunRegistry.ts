import type { EntityId } from '@/app/backend/runtime/contracts';

export interface ActiveOrchestratorRun {
    profileId: string;
    sessionId: EntityId<'sess'>;
    cancelled: boolean;
}

export class ActiveOrchestratorRunRegistry {
    private readonly activeRuns = new Map<EntityId<'orch'>, ActiveOrchestratorRun>();

    begin(runId: EntityId<'orch'>, state: Omit<ActiveOrchestratorRun, 'cancelled'>): void {
        this.activeRuns.set(runId, {
            ...state,
            cancelled: false,
        });
    }

    get(runId: EntityId<'orch'>): ActiveOrchestratorRun | undefined {
        return this.activeRuns.get(runId);
    }

    cancel(runId: EntityId<'orch'>): ActiveOrchestratorRun | undefined {
        const active = this.activeRuns.get(runId);
        if (!active) {
            return undefined;
        }

        active.cancelled = true;
        return active;
    }

    finish(runId: EntityId<'orch'>): void {
        this.activeRuns.delete(runId);
    }
}
