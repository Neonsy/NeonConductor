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
    apiKeyInput: string;
    activeAuthFlow: ActiveAuthFlow | undefined;
    isSavingApiKey: boolean;
    isStartingAuth: boolean;
    isPollingAuth: boolean;
    isCancellingAuth: boolean;
    onApiKeyInputChange: (value: string) => void;
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
    apiKeyInput,
    activeAuthFlow,
    isSavingApiKey,
    isStartingAuth,
    isPollingAuth,
    isCancellingAuth,
    onApiKeyInputChange,
    onSaveApiKey,
    onStartOAuthDevice,
    onStartDeviceCode,
    onPollNow,
    onCancelFlow,
}: ProviderAuthenticationSectionProps) {
    return (
        <section className='space-y-2'>
            <p className='text-sm font-semibold'>Authentication</p>
            <p className='text-muted-foreground text-xs'>
                State: {selectedAuthState?.authState ?? selectedProviderAuthState} (
                {selectedAuthState?.authMethod ?? selectedProviderAuthMethod})
            </p>

            {methods.includes('api_key') ? (
                <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <input
                        type='password'
                        value={apiKeyInput}
                        onChange={(event) => {
                            onApiKeyInputChange(event.target.value);
                        }}
                        className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                        placeholder='Paste API key'
                    />
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={apiKeyInput.trim().length === 0 || isSavingApiKey || !selectedProviderId}
                        onClick={onSaveApiKey}>
                        Save Key
                    </Button>
                </div>
            ) : null}

            <div className='flex flex-wrap gap-2'>
                {methods.includes('oauth_device') ? (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isStartingAuth || selectedProviderId !== 'openai'}
                        onClick={onStartOAuthDevice}>
                        Start OAuth Device
                    </Button>
                ) : null}
                {methods.includes('device_code') ? (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isStartingAuth || selectedProviderId !== 'kilo'}
                        onClick={onStartDeviceCode}>
                        Start Device Code
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
                            Poll Now
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isCancellingAuth}
                            onClick={onCancelFlow}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
