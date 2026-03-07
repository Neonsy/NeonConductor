import { SensitiveValue } from '@/web/components/ui/sensitiveValue';
import { Button } from '@/web/components/ui/button';
import { usePrivacyMode } from '@/web/lib/privacy/privacyContext';

import type { KiloAccountContext } from '@/app/backend/runtime/contracts';

interface KiloAccountSectionProps {
    authState: string;
    accountContext: KiloAccountContext | undefined;
    isLoading: boolean;
    isSavingOrganization: boolean;
    onOrganizationChange: (organizationId?: string) => void;
}

function formatUpdatedAt(value: string | undefined): string {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function resolveActiveOrganizationId(accountContext: KiloAccountContext | undefined): string {
    const activeOrganization = accountContext?.organizations.find((organization) => organization.isActive);
    return activeOrganization?.organizationId ?? '';
}

export function KiloAccountSection({
    authState,
    accountContext,
    isLoading,
    isSavingOrganization,
    onOrganizationChange,
}: KiloAccountSectionProps) {
    const { enabled, redactValue } = usePrivacyMode();

    if (isLoading) {
        return (
            <section className='space-y-2'>
                <p className='text-sm font-semibold'>Kilo Account</p>
                <p className='text-muted-foreground text-xs'>Loading Kilo account context...</p>
            </section>
        );
    }

    const activeOrganizationId = resolveActiveOrganizationId(accountContext);

    return (
        <section className='space-y-3'>
            <div>
                <p className='text-sm font-semibold'>Kilo Account</p>
                <p className='text-muted-foreground text-xs'>
                    Local runtime stays usable without Kilo. These controls are only for Kilo account and organization
                    context.
                </p>
            </div>

            <div className='grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'>
                <div className='border-border bg-background rounded-xl border p-4'>
                    <p className='text-xs font-semibold tracking-[0.12em] uppercase'>Account Snapshot</p>
                    <dl className='mt-3 space-y-2 text-sm'>
                        <div className='grid grid-cols-[8rem_1fr] gap-2'>
                            <dt className='text-muted-foreground'>Auth state</dt>
                            <dd className='font-medium'>{authState}</dd>
                        </div>
                        <div className='grid grid-cols-[8rem_1fr] gap-2'>
                            <dt className='text-muted-foreground'>Display name</dt>
                            <dd>
                                <SensitiveValue value={accountContext?.displayName} category='person' />
                            </dd>
                        </div>
                        <div className='grid grid-cols-[8rem_1fr] gap-2'>
                            <dt className='text-muted-foreground'>Email</dt>
                            <dd>
                                <SensitiveValue value={accountContext?.emailMasked} category='email' />
                            </dd>
                        </div>
                        <div className='grid grid-cols-[8rem_1fr] gap-2'>
                            <dt className='text-muted-foreground'>Account ID</dt>
                            <dd>
                                <SensitiveValue value={accountContext?.accountId} category='account_id' />
                            </dd>
                        </div>
                        <div className='grid grid-cols-[8rem_1fr] gap-2'>
                            <dt className='text-muted-foreground'>Last sync</dt>
                            <dd>{formatUpdatedAt(accountContext?.updatedAt)}</dd>
                        </div>
                    </dl>
                </div>

                <div className='border-border bg-background rounded-xl border p-4'>
                    <p className='text-xs font-semibold tracking-[0.12em] uppercase'>Organization</p>
                    <div className='mt-3 space-y-3'>
                        <label className='space-y-1'>
                            <span className='text-muted-foreground block text-xs'>Active organization</span>
                            <select
                                className='border-border bg-card h-10 w-full rounded-lg border px-3 text-sm'
                                value={activeOrganizationId}
                                disabled={isSavingOrganization || (accountContext?.organizations.length ?? 0) === 0}
                                onChange={(event) => {
                                    const nextValue = event.target.value.trim();
                                    onOrganizationChange(nextValue.length > 0 ? nextValue : undefined);
                                }}>
                                <option value=''>Account default</option>
                                {(accountContext?.organizations ?? []).map((organization) => (
                                    <option key={organization.id} value={organization.organizationId}>
                                        {enabled
                                            ? redactValue(organization.name, 'organization')
                                            : organization.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className='space-y-2'>
                            {(accountContext?.organizations ?? []).map((organization) => (
                                <div
                                    key={organization.id}
                                    className={`rounded-lg border px-3 py-2 text-sm ${
                                        organization.isActive
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border bg-card'
                                    }`}>
                                    <div className='flex items-center justify-between gap-3'>
                                        <SensitiveValue value={organization.name} category='organization' />
                                        {organization.isActive ? (
                                            <span className='text-primary text-[11px] font-semibold tracking-[0.12em] uppercase'>
                                                Active
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className='text-muted-foreground mt-1 text-xs'>
                                        <SensitiveValue value={organization.organizationId} category='account_id' />
                                    </p>
                                </div>
                            ))}
                            {(accountContext?.organizations.length ?? 0) === 0 ? (
                                <p className='text-muted-foreground text-xs'>
                                    No organizations returned for this account yet.
                                </p>
                            ) : null}
                        </div>

                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isSavingOrganization}
                            onClick={() => {
                                onOrganizationChange(undefined);
                            }}>
                            Reset to account default
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
