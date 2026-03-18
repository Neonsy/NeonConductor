import type { EntityId } from '@/app/backend/runtime/contracts';

export interface ActiveOrchestratorRun {
    profileId: string;
    sessionId: EntityId<'sess'>;
    cancelled: boolean;
    childSessionIds: Set<EntityId<'sess'>>;
}

export class ActiveOrchestratorRunRegistry {
    private readonly activeRuns = new Map<EntityId<'orch'>, ActiveOrchestratorRun>();

    begin(runId: EntityId<'orch'>, state: Omit<ActiveOrchestratorRun, 'cancelled'>): void {
        this.activeRuns.set(runId, {
            ...state,
            cancelled: false,
            childSessionIds: new Set<EntityId<'sess'>>(),
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

    registerChildSession(runId: EntityId<'orch'>, childSessionId: EntityId<'sess'>): void {
        this.activeRuns.get(runId)?.childSessionIds.add(childSessionId);
    }

    unregisterChildSession(runId: EntityId<'orch'>, childSessionId: EntityId<'sess'>): void {
        this.activeRuns.get(runId)?.childSessionIds.delete(childSessionId);
    }

    finish(runId: EntityId<'orch'>): void {
        this.activeRuns.delete(runId);
    }
}
