import { ExternalLink } from 'lucide-react';

import type { ActiveAuthFlow, ProviderAuthStateView } from '@/web/components/settings/providerSettings/types';
import { Button } from '@/web/components/ui/button';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface ProviderAuthenticationSectionProps {
    selectedProviderId: RuntimeProviderId | undefined;
    selectedProviderAuthState: string;
    selectedProviderAuthMethod: string;
    selectedAuthState: ProviderAuthStateView | undefined;
    methods: string[];
    endpointProfileValue: string;
    endpointProfileOptions: Array<{ value: string; label: string }>;
    apiKeyCta?: { label: string; url: string };
    apiKeyInput: string;
    activeAuthFlow: ActiveAuthFlow | undefined;
    isSavingApiKey: boolean;
    isSavingEndpointProfile: boolean;
    isStartingAuth: boolean;
    isPollingAuth: boolean;
    isCancellingAuth: boolean;
    onApiKeyInputChange: (value: string) => void;
    onEndpointProfileChange: (value: string) => void;
    onSaveApiKey: () => void;
    onStartOAuthDevice: () => void;
    onStartDeviceCode: () => void;
    onPollNow: () => void;
    onCancelFlow: () => void;
}

export function ProviderAuthenticationSection({
    selectedProviderId,
    selectedProviderAuthState,
    selectedProviderAuthMethod,
    selectedAuthState,
    methods,
    endpointProfileValue,
    endpointProfileOptions,
    apiKeyCta,
    apiKeyInput,
    activeAuthFlow,
    isSavingApiKey,
    isSavingEndpointProfile,
    isStartingAuth,
    isPollingAuth,
    isCancellingAuth,
    onApiKeyInputChange,
    onEndpointProfileChange,
    onSaveApiKey,
    onStartOAuthDevice,
    onStartDeviceCode,
    onPollNow,
    onCancelFlow,
}: ProviderAuthenticationSectionProps) {
    return (
        <section className='space-y-3 rounded-2xl border border-border/70 bg-card/40 p-4'>
            <div className='space-y-1'>
                <p className='text-sm font-semibold'>Authentication</p>
                <p className='text-muted-foreground text-xs'>
                    Connect the provider once, then keep model selection local to the active profile.
                </p>
            </div>
            <p className='text-muted-foreground text-xs'>
                State: {selectedAuthState?.authState ?? selectedProviderAuthState} (
                {selectedAuthState?.authMethod ?? selectedProviderAuthMethod})
            </p>

            {methods.includes('api_key') ? (
                <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <label className='sr-only' htmlFor='provider-api-key-input'>
                        API key
                    </label>
                    <input
                        id='provider-api-key-input'
                        name='providerApiKey'
                        type='password'
                        value={apiKeyInput}
                        onChange={(event) => {
                            onApiKeyInputChange(event.target.value);
                        }}
                        className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                        autoComplete='off'
                        placeholder='Paste API key…'
                    />
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={apiKeyInput.trim().length === 0 || isSavingApiKey || !selectedProviderId}
                        onClick={onSaveApiKey}>
                        {isSavingApiKey ? 'Saving…' : 'Save API Key'}
                    </Button>
                </div>
            ) : null}

            {endpointProfileOptions.length > 1 ? (
                <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <label className='sr-only' htmlFor='provider-endpoint-profile'>
                        Endpoint profile
                    </label>
                    <select
                        id='provider-endpoint-profile'
                        name='providerEndpointProfile'
                        value={endpointProfileValue}
                        onChange={(event) => {
                            onEndpointProfileChange(event.target.value);
                        }}
                        className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                        disabled={isSavingEndpointProfile}>
                        {endpointProfileOptions.map((profile) => (
                            <option key={profile.value} value={profile.value}>
                                {profile.label}
                            </option>
                        ))}
                    </select>
                    <span className='text-muted-foreground flex items-center text-xs'>Endpoint profile</span>
                </div>
            ) : null}

            {apiKeyCta ? (
                <Button type='button' size='sm' variant='outline' asChild>
                    <a href={apiKeyCta.url} target='_blank' rel='noreferrer'>
                        {apiKeyCta.label}
                        <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                </Button>
            ) : null}

                <div className='flex flex-wrap gap-2'>
                {methods.includes('oauth_device') ? (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isStartingAuth || !selectedProviderId}
                        onClick={onStartOAuthDevice}>
                        {isStartingAuth ? 'Starting…' : 'Start OAuth Device'}
                    </Button>
                ) : null}
                {methods.includes('device_code') ? (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isStartingAuth || !selectedProviderId}
                        onClick={onStartDeviceCode}>
                        {isStartingAuth ? 'Starting…' : 'Start Device Code'}
                    </Button>
                ) : null}
            </div>

            {activeAuthFlow && activeAuthFlow.providerId === selectedProviderId ? (
                <div className='border-border bg-background rounded-md border p-3'>
                    <p className='text-xs font-semibold'>Auth flow in progress</p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                        Enter code{' '}
                        <span className='text-foreground font-semibold'>{activeAuthFlow.userCode ?? '-'}</span> and
                        confirm in browser.
                    </p>
                    {activeAuthFlow.verificationUri ? (
                        <a
                            href={activeAuthFlow.verificationUri}
                            target='_blank'
                            rel='noreferrer'
                            className='text-primary mt-1 inline-flex items-center gap-1 text-xs underline'>
                            Open verification page
                            <ExternalLink className='h-3 w-3' />
                        </a>
                    ) : null}
                    <div className='mt-2 flex gap-2'>
                        <Button type='button' size='sm' variant='outline' disabled={isPollingAuth} onClick={onPollNow}>
                            {isPollingAuth ? 'Polling…' : 'Poll Now'}
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isCancellingAuth}
                            onClick={onCancelFlow}>
                            {isCancellingAuth ? 'Cancelling…' : 'Cancel'}
                        </Button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
