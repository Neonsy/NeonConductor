export interface ActiveFlowExecution {
    controller: AbortController;
}

export class ActiveFlowExecutionRegistry {
    private readonly activeExecutions = new Map<string, ActiveFlowExecution>();

    begin(flowInstanceId: string): AbortController | null {
        if (this.activeExecutions.has(flowInstanceId)) {
            return null;
        }

        const controller = new AbortController();
        this.activeExecutions.set(flowInstanceId, { controller });
        return controller;
    }

    get(flowInstanceId: string): ActiveFlowExecution | undefined {
        return this.activeExecutions.get(flowInstanceId);
    }

    cancel(flowInstanceId: string): ActiveFlowExecution | undefined {
        const activeExecution = this.activeExecutions.get(flowInstanceId);
        if (!activeExecution) {
            return undefined;
        }

        activeExecution.controller.abort();
        return activeExecution;
    }

    finish(flowInstanceId: string): void {
        this.activeExecutions.delete(flowInstanceId);
    }
}

export const activeFlowExecutionRegistry = new ActiveFlowExecutionRegistry();
