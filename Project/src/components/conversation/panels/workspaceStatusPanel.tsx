import { formatInteger, methodLabel } from '@/web/components/settings/providerSettings/helpers';

import type { ProviderUsageSummary, RunRecord } from '@/app/backend/persistence/types';

interface WorkspaceStatusPanelProps {
    run: RunRecord | undefined;
    provider:
        | {
              label: string;
              authState: string;
              authMethod: string;
          }
        | undefined;
    modelLabel: string | undefined;
    usageSummary: ProviderUsageSummary | undefined;
    routingBadge: string | undefined;
}

function formatMicrounits(value: number | undefined): string {
    if (value === undefined || !Number.isFinite(value)) {
        return '-';
    }

    return `${Math.round(value).toLocaleString()} microunits`;
}

function StatusCard({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className='border-border bg-card rounded-xl border px-3 py-3'>
            <p className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>{label}</p>
            <p className='mt-2 text-sm font-semibold'>{value}</p>
            <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
        </div>
    );
}

export function WorkspaceStatusPanel({
    run,
    provider,
    modelLabel,
    usageSummary,
    routingBadge,
}: WorkspaceStatusPanelProps) {
    return (
        <section className='mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
            <StatusCard
                label='Run'
                value={run ? run.status : 'idle'}
                detail={run ? `${run.id}${run.errorMessage ? ` · ${run.errorMessage}` : ''}` : 'No run selected'}
            />
            <StatusCard
                label='Provider'
                value={provider?.label ?? 'Unresolved'}
                detail={
                    provider
                        ? `${provider.authState} via ${methodLabel(provider.authMethod)}${routingBadge ? ` · ${routingBadge}` : ''}`
                        : 'Select a runnable provider/model pair'
                }
            />
            <StatusCard
                label='Model'
                value={modelLabel ?? 'Unresolved'}
                detail={run?.modelId ?? 'Composer target model'}
            />
            <StatusCard
                label='Local Usage'
                value={usageSummary ? `${formatInteger(usageSummary.totalTokens)} tokens` : 'No usage'}
                detail={
                    usageSummary
                        ? `${formatInteger(usageSummary.runCount)} runs · ${formatMicrounits(usageSummary.totalCostMicrounits)}`
                        : 'No local telemetry for this provider yet'
                }
            />
        </section>
    );
}
