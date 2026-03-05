import type { ProviderListItem } from '@/web/components/settings/providerSettings/types';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface ProviderSidebarProps {
    providers: ProviderListItem[];
    selectedProviderId: RuntimeProviderId | undefined;
    onSelectProvider: (providerId: RuntimeProviderId) => void;
}

export function ProviderSidebar({ providers, selectedProviderId, onSelectProvider }: ProviderSidebarProps) {
    return (
        <aside className='border-border bg-background/40 min-h-0 overflow-y-auto border-r p-3'>
            <p className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>Providers</p>
            <div className='space-y-2'>
                {providers.map((provider) => (
                    <button
                        key={provider.id}
                        type='button'
                        className={`w-full rounded-md border px-2 py-2 text-left ${
                            provider.id === selectedProviderId
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-card hover:bg-accent'
                        }`}
                        onClick={() => {
                            onSelectProvider(provider.id);
                        }}>
                        <p className='text-sm font-medium'>
                            {provider.label}{' '}
                            {provider.isDefault ? <span className='text-primary text-xs'>(default)</span> : null}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                            auth: {provider.authState} ({provider.authMethod})
                        </p>
                    </button>
                ))}
            </div>
        </aside>
    );
}
