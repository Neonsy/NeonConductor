import { formatInteger, methodLabel } from '@/web/components/settings/providerSettings/helpers';

import type { ProviderUsageSummary, RunRecord } from '@/app/backend/persistence/types';

interface WorkspaceStatusPanelProps {
    run: RunRecord | undefined;
    executionPreset: 'privacy' | 'standard' | 'yolo';
    workspaceScope:
        | {
              kind: 'detached';
          }
        | {
              kind: 'workspace';
              label: string;
              absolutePath: string;
          };
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
    registrySummary?:
        | {
              modes: number;
              rulesets: number;
              skillfiles: number;
          }
        | undefined;
    agentContextSummary?:
        | {
              modeLabel: string;
              rulesetCount: number;
              attachedSkillCount: number;
          }
        | undefined;
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
    executionPreset,
    workspaceScope,
    provider,
    modelLabel,
    usageSummary,
    routingBadge,
    registrySummary,
    agentContextSummary,
}: WorkspaceStatusPanelProps) {
    return (
        <section
            className={`mb-3 grid gap-2 md:grid-cols-2 ${
                registrySummary || agentContextSummary ? 'xl:grid-cols-6' : 'xl:grid-cols-4'
            }`}>
            <StatusCard
                label='Run'
                value={run ? run.status : 'idle'}
                detail={run ? `${run.id}${run.errorMessage ? ` · ${run.errorMessage}` : ''}` : 'No run selected'}
            />
            <StatusCard
                label='Scope'
                value={workspaceScope.kind === 'workspace' ? workspaceScope.label : 'Detached'}
                detail={
                    workspaceScope.kind === 'workspace'
                        ? `${executionPreset} preset · ${workspaceScope.absolutePath}`
                        : `${executionPreset} preset · detached chat has no file authority`
                }
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
                label='Local Usage'
                value={usageSummary ? `${formatInteger(usageSummary.totalTokens)} tokens` : 'No usage'}
                detail={
                    usageSummary
                        ? `${formatInteger(usageSummary.runCount)} runs · ${formatMicrounits(usageSummary.totalCostMicrounits)}`
                        : 'No local telemetry for this provider yet'
                }
            />
            <StatusCard
                label='Model'
                value={modelLabel ?? 'Unresolved'}
                detail={run?.modelId ?? 'Composer target model'}
            />
            {agentContextSummary ? (
                <StatusCard
                    label='Agent Context'
                    value={agentContextSummary.modeLabel}
                    detail={`${formatInteger(agentContextSummary.rulesetCount)} rules · ${formatInteger(agentContextSummary.attachedSkillCount)} attached skills`}
                />
            ) : null}
            {registrySummary ? (
                <StatusCard
                    label='Registry'
                    value={`${formatInteger(registrySummary.skillfiles)} skills`}
                    detail={`${formatInteger(registrySummary.modes)} modes · ${formatInteger(registrySummary.rulesets)} rules`}
                />
            ) : null}
        </section>
    );
}
