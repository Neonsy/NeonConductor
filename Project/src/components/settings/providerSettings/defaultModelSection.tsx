import { RefreshCw } from 'lucide-react';

import { formatMetric } from '@/web/components/settings/providerSettings/helpers';
import type { ProviderModelOption } from '@/web/components/settings/providerSettings/types';
import { Button } from '@/web/components/ui/button';

import type { RuntimeProviderId } from '@/shared/contracts';

interface ProviderDefaultModelSectionProps {
    selectedProviderId: RuntimeProviderId | undefined;
    selectedModelId: string;
    models: ProviderModelOption[];
    isDefaultModel: boolean;
    isSavingDefault: boolean;
    isSyncingCatalog: boolean;
    onSelectModel: (modelId: string) => void;
    onSetDefault: () => void;
    onSyncCatalog: () => void;
}

export function ProviderDefaultModelSection({
    selectedProviderId,
    selectedModelId,
    models,
    isDefaultModel,
    isSavingDefault,
    isSyncingCatalog,
    onSelectModel,
    onSetDefault,
    onSyncCatalog,
}: ProviderDefaultModelSectionProps) {
    return (
        <section className='space-y-3 rounded-2xl border border-border/70 bg-card/40 p-4'>
            <div className='space-y-1'>
                <p className='text-sm font-semibold'>Default Model</p>
                <p className='text-muted-foreground text-xs'>
                    Choose the model that should be preselected for this provider in settings and the composer.
                </p>
            </div>
            <div className='grid grid-cols-[1fr_auto_auto] gap-2'>
                <label className='sr-only' htmlFor='provider-default-model'>
                    Default model
                </label>
                <select
                    id='provider-default-model'
                    name='providerDefaultModel'
                    value={selectedModelId}
                    onChange={(event) => {
                        onSelectModel(event.target.value);
                    }}
                    className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                    disabled={models.length === 0}>
                    {models.length === 0 ? (
                        <option value=''>No runnable models available</option>
                    ) : (
                        models.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.label}
                                {selectedProviderId === 'kilo'
                                    ? ` · price ${formatMetric(model.price)} · latency ${formatMetric(model.latency)} · tps ${formatMetric(model.tps)}`
                                    : ''}
                            </option>
                        ))
                    )}
                </select>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={!selectedModelId || isSavingDefault || isDefaultModel}
                    onClick={onSetDefault}>
                    {isDefaultModel ? 'Default' : 'Set Default'}
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={isSyncingCatalog || !selectedProviderId}
                    onClick={onSyncCatalog}>
                    <RefreshCw className='h-3.5 w-3.5' />
                    {isSyncingCatalog ? 'Syncing…' : 'Sync'}
                </Button>
            </div>
        </section>
    );
}

