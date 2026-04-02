import { useEffect, useState } from 'react';

import { ProviderAuthFlowSection } from '@/web/components/settings/providerSettings/authentication/providerAuthFlowSection';
import { ProviderConnectionDetailsSection } from '@/web/components/settings/providerSettings/authentication/providerConnectionDetailsSection';
import { ProviderCredentialSection } from '@/web/components/settings/providerSettings/authentication/providerCredentialSection';
import type { ProviderCredentialActionStatus } from '@/web/components/settings/providerSettings/authentication/providerCredentialSection';
import type { ActiveAuthFlow, ProviderAuthStateView } from '@/web/components/settings/providerSettings/types';

import { launchBackgroundTask } from '@/shared/async/launchBackgroundTask';
import type { OpenAIExecutionMode, RuntimeProviderId } from '@/shared/contracts';

interface ProviderAuthenticationSectionProps {
    selectedProviderId: RuntimeProviderId | undefined;
    selectedProviderAuthState: string;
    selectedProviderAuthMethod: string;
    selectedAuthState: ProviderAuthStateView | undefined;
    methods: string[];
    connectionProfileValue: string;
    connectionProfileOptions: Array<{ value: string; label: string }>;
    supportsCustomBaseUrl: boolean;
    baseUrlOverrideValue: string;
    resolvedBaseUrl: string | null;
    executionPreference:
        | {
              mode: OpenAIExecutionMode;
              canUseRealtimeWebSocket: boolean;
              disabledReason?: 'provider_not_supported' | 'api_key_required' | 'base_url_not_supported';
          }
        | undefined;
    apiKeyCta?: { label: string; url: string };
    credentialSummary?: {
        hasStoredCredential: boolean;
        credentialSource: 'api_key' | 'access_token' | null;
        maskedValue?: string;
    };
    activeAuthFlow: ActiveAuthFlow | undefined;
    isSavingApiKey: boolean;
    isSavingConnectionProfile: boolean;
    isSavingExecutionPreference: boolean;
    isStartingAuth: boolean;
    isPollingAuth: boolean;
    isCancellingAuth: boolean;
    isOpeningVerificationPage: boolean;
    onConnectionProfileChange: (value: string) => void;
    onExecutionPreferenceChange: (mode: OpenAIExecutionMode) => void;
    onSaveApiKey: (value: string) => Promise<void>;
    onSaveBaseUrlOverride: (value: string) => Promise<void>;
    onLoadStoredCredential: () => Promise<string | undefined>;
    onStartOAuthDevice: () => void;
    onStartDeviceCode: () => void;
    onPollNow: () => void;
    onCancelFlow: () => void;
    onOpenVerificationPage: () => void;
}

interface ProviderAuthenticationDraftState {
    apiKeyInput: string;
    baseUrlOverrideInput: string;
    isCredentialVisible: boolean;
    hasLoadedStoredCredential: boolean;
}

interface ProviderCredentialActionResult {
    draftState?: ProviderAuthenticationDraftState;
    status?: ProviderCredentialActionStatus;
}

function createProviderAuthenticationDraftState(baseUrlOverrideValue: string): ProviderAuthenticationDraftState {
    return {
        apiKeyInput: '',
        baseUrlOverrideInput: baseUrlOverrideValue,
        isCredentialVisible: false,
        hasLoadedStoredCredential: false,
    };
}

export async function resolveRevealStoredCredentialAction(input: {
    draftState: ProviderAuthenticationDraftState;
    hasStoredCredential: boolean;
    onLoadStoredCredential: () => Promise<string | undefined>;
}): Promise<ProviderCredentialActionResult> {
    try {
        if (input.draftState.apiKeyInput.trim().length === 0 && input.hasStoredCredential) {
            const credentialValue = await input.onLoadStoredCredential();
            if (!credentialValue) {
                return {};
            }

            return {
                draftState: {
                    ...input.draftState,
                    apiKeyInput: credentialValue,
                    isCredentialVisible: true,
                    hasLoadedStoredCredential: true,
                },
            };
        }

        return {
            draftState: {
                ...input.draftState,
                isCredentialVisible: true,
            },
        };
    } catch {
        return {
            status: {
                tone: 'error',
                message: 'Failed to reveal the stored credential.',
            },
        };
    }
}

export async function resolveCopyStoredCredentialAction(input: {
    draftState: ProviderAuthenticationDraftState;
    onLoadStoredCredential: () => Promise<string | undefined>;
    writeText: (value: string) => Promise<void>;
}): Promise<ProviderCredentialActionResult> {
    try {
        const credentialValue =
            input.draftState.apiKeyInput.trim().length > 0
                ? input.draftState.apiKeyInput
                : await input.onLoadStoredCredential();
        if (!credentialValue) {
            return {};
        }

        await input.writeText(credentialValue);

        return {
            draftState: {
                ...input.draftState,
                hasLoadedStoredCredential: true,
            },
            status: {
                tone: 'success',
                message: 'Credential copied.',
            },
        };
    } catch {
        return {
            status: {
                tone: 'error',
                message: 'Failed to copy the stored credential.',
            },
        };
    }
}

export function buildProviderAuthenticationDraftKey(input: {
    selectedProviderId: RuntimeProviderId | undefined;
    connectionProfileValue: string;
    baseUrlOverrideValue: string;
}): string {
    return `${input.selectedProviderId ?? 'none'}:${input.connectionProfileValue}:${input.baseUrlOverrideValue}`;
}

export function shouldHydrateKiloStoredCredential(input: {
    selectedProviderId: RuntimeProviderId | undefined;
    credentialSource: 'api_key' | 'access_token' | null | undefined;
    hasLoadedStoredCredential: boolean;
    apiKeyInput: string;
}): boolean {
    return (
        input.selectedProviderId === 'kilo' &&
        input.credentialSource === 'access_token' &&
        !input.hasLoadedStoredCredential &&
        input.apiKeyInput.trim().length === 0
    );
}

export function applyHydratedKiloStoredCredential(input: {
    draftState: ProviderAuthenticationDraftState;
    selectedProviderId: RuntimeProviderId | undefined;
    credentialSource: 'api_key' | 'access_token' | null | undefined;
    credentialValue: string | undefined;
}): ProviderAuthenticationDraftState {
    if (
        !input.credentialValue ||
        !shouldHydrateKiloStoredCredential({
            selectedProviderId: input.selectedProviderId,
            credentialSource: input.credentialSource,
            hasLoadedStoredCredential: input.draftState.hasLoadedStoredCredential,
            apiKeyInput: input.draftState.apiKeyInput,
        })
    ) {
        return input.draftState;
    }

    return {
        ...input.draftState,
        apiKeyInput: input.credentialValue,
        hasLoadedStoredCredential: true,
    };
}

function AuthStateBadge({ authState, authMethod }: { authState: string; authMethod: string }) {
    return (
        <div className='flex flex-wrap items-center gap-2 text-xs'>
            <span className='border-border/70 bg-background rounded-full border px-2.5 py-1 font-medium'>
                State {authState}
            </span>
            <span className='text-muted-foreground'>via {authMethod.replace('_', ' ')}</span>
        </div>
    );
}

export function ProviderAuthenticationSection({
    selectedProviderId,
    connectionProfileValue,
    baseUrlOverrideValue,
    ...props
}: ProviderAuthenticationSectionProps) {
    return (
        <ProviderAuthenticationDraftBoundary
            key={buildProviderAuthenticationDraftKey({
                selectedProviderId,
                connectionProfileValue,
                baseUrlOverrideValue,
            })}
            selectedProviderId={selectedProviderId}
            connectionProfileValue={connectionProfileValue}
            baseUrlOverrideValue={baseUrlOverrideValue}
            {...props}
        />
    );
}

function ProviderAuthenticationDraftBoundary({
    selectedProviderId,
    selectedProviderAuthState,
    selectedProviderAuthMethod,
    selectedAuthState,
    methods,
    connectionProfileValue,
    connectionProfileOptions,
    supportsCustomBaseUrl,
    baseUrlOverrideValue,
    resolvedBaseUrl,
    executionPreference,
    apiKeyCta,
    credentialSummary,
    activeAuthFlow,
    isSavingApiKey,
    isSavingConnectionProfile,
    isSavingExecutionPreference,
    isStartingAuth,
    isPollingAuth,
    isCancellingAuth,
    isOpeningVerificationPage,
    onConnectionProfileChange,
    onExecutionPreferenceChange,
    onSaveApiKey,
    onSaveBaseUrlOverride,
    onLoadStoredCredential,
    onStartOAuthDevice,
    onStartDeviceCode,
    onPollNow,
    onCancelFlow,
    onOpenVerificationPage,
}: ProviderAuthenticationSectionProps) {
    const [draftState, setDraftState] = useState(() => createProviderAuthenticationDraftState(baseUrlOverrideValue));
    const [credentialActionStatus, setCredentialActionStatus] = useState<ProviderCredentialActionStatus | undefined>(
        undefined
    );
    const effectiveAuthState = selectedAuthState?.authState ?? selectedProviderAuthState;
    const effectiveAuthMethod = selectedAuthState?.authMethod ?? selectedProviderAuthMethod;
    const isKilo = selectedProviderId === 'kilo';
    const canUseApiKey = methods.includes('api_key');
    const activeFlowForSelectedProvider =
        activeAuthFlow?.providerId === selectedProviderId ? activeAuthFlow : undefined;
    const isAuthenticated = effectiveAuthState === 'authenticated';
    const kiloCredentialLabel =
        credentialSummary?.credentialSource === 'access_token'
            ? 'Browser session token is stored locally for Kilo.'
            : credentialSummary?.credentialSource === 'api_key'
              ? 'An API key is stored locally for Kilo.'
              : 'Kilo account access is ready in this profile.';

    useEffect(() => {
        if (
            !shouldHydrateKiloStoredCredential({
                selectedProviderId,
                credentialSource: credentialSummary?.credentialSource,
                hasLoadedStoredCredential: draftState.hasLoadedStoredCredential,
                apiKeyInput: draftState.apiKeyInput,
            })
        ) {
            return;
        }

        let cancelled = false;
        const loadStoredCredential = async (): Promise<void> => {
            const credentialValue = await onLoadStoredCredential();
            if (cancelled) {
                return;
            }

            setDraftState((current) =>
                applyHydratedKiloStoredCredential({
                    draftState: current,
                    selectedProviderId,
                    credentialSource: credentialSummary?.credentialSource,
                    credentialValue,
                })
            );
        };

        launchBackgroundTask(loadStoredCredential);

        return () => {
            cancelled = true;
        };
    }, [
        draftState.apiKeyInput,
        draftState.hasLoadedStoredCredential,
        credentialSummary?.credentialSource,
        onLoadStoredCredential,
        selectedProviderId,
    ]);

    const revealStoredCredential = async (): Promise<void> => {
        const result = await resolveRevealStoredCredentialAction({
            draftState,
            hasStoredCredential: credentialSummary?.hasStoredCredential ?? false,
            onLoadStoredCredential,
        });
        if (result.draftState) {
            setDraftState(result.draftState);
        }

        setCredentialActionStatus(result.status);
    };

    const copyStoredCredential = async (): Promise<void> => {
        const result = await resolveCopyStoredCredentialAction({
            draftState,
            onLoadStoredCredential,
            writeText: (value) => navigator.clipboard.writeText(value),
        });
        if (result.draftState) {
            setDraftState(result.draftState);
        }

        setCredentialActionStatus(result.status);
    };

    const saveApiKey = (): void => {
        launchBackgroundTask(async () => {
            await onSaveApiKey(draftState.apiKeyInput);
            setDraftState((current) => ({
                ...current,
                apiKeyInput: '',
                isCredentialVisible: false,
                hasLoadedStoredCredential: false,
            }));
        });
    };

    const saveBaseUrlOverride = (): void => {
        launchBackgroundTask(async () => {
            await onSaveBaseUrlOverride(draftState.baseUrlOverrideInput);
        });
    };

    return (
        <section className='border-border/70 bg-card/55 space-y-4 rounded-[24px] border p-5'>
            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                <div className='min-w-0 space-y-1'>
                    <p className='text-sm font-semibold'>{isKilo ? 'Kilo Access' : 'Authentication'}</p>
                    <p className='text-muted-foreground text-xs leading-5'>
                        {isKilo
                            ? 'Use browser sign-in for the app-first Kilo flow. API keys stay available only as an advanced fallback.'
                            : 'Connect the provider once, then keep model selection local to the active profile.'}
                    </p>
                </div>
                <div className='self-start'>
                    <AuthStateBadge authState={effectiveAuthState} authMethod={effectiveAuthMethod} />
                </div>
            </div>

            <div className='space-y-4'>
                <ProviderAuthFlowSection
                    isKilo={isKilo}
                    isAuthenticated={isAuthenticated}
                    methods={methods}
                    activeUserCode={activeFlowForSelectedProvider?.userCode}
                    activeVerificationUri={activeFlowForSelectedProvider?.verificationUri}
                    credentialLabel={kiloCredentialLabel}
                    isStartingAuth={isStartingAuth}
                    isPollingAuth={isPollingAuth}
                    isCancellingAuth={isCancellingAuth}
                    isOpeningVerificationPage={isOpeningVerificationPage}
                    onStartOAuthDevice={onStartOAuthDevice}
                    onStartDeviceCode={onStartDeviceCode}
                    onPollNow={onPollNow}
                    onCancelFlow={onCancelFlow}
                    onOpenVerificationPage={onOpenVerificationPage}
                />

                <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]'>
                    <div className='min-w-0'>
                        <ProviderCredentialSection
                            selectedProviderId={selectedProviderId}
                            isKilo={isKilo}
                            canUseApiKey={canUseApiKey}
                            apiKeyInput={draftState.apiKeyInput}
                            isCredentialVisible={draftState.isCredentialVisible}
                            isSavingApiKey={isSavingApiKey}
                            apiKeyCta={apiKeyCta}
                            credentialSummary={credentialSummary}
                            {...(credentialActionStatus ? { credentialActionStatus } : {})}
                            onApiKeyInputChange={(apiKeyInput) => {
                                setDraftState((current) => ({
                                    ...current,
                                    apiKeyInput,
                                }));
                                setCredentialActionStatus(undefined);
                            }}
                            onSaveApiKey={saveApiKey}
                            onRevealStoredCredential={revealStoredCredential}
                            onHideStoredCredential={() => {
                                setDraftState((current) => ({
                                    ...current,
                                    isCredentialVisible: false,
                                }));
                                setCredentialActionStatus(undefined);
                            }}
                            onCopyStoredCredential={copyStoredCredential}
                        />
                    </div>

                    <ProviderConnectionDetailsSection
                        selectedProviderId={selectedProviderId}
                        connectionProfileValue={connectionProfileValue}
                        connectionProfileOptions={connectionProfileOptions}
                        supportsCustomBaseUrl={supportsCustomBaseUrl}
                        baseUrlOverrideValue={draftState.baseUrlOverrideInput}
                        resolvedBaseUrl={resolvedBaseUrl}
                        executionPreference={executionPreference}
                        isSavingConnectionProfile={isSavingConnectionProfile}
                        isSavingExecutionPreference={isSavingExecutionPreference}
                        onConnectionProfileChange={onConnectionProfileChange}
                        onExecutionPreferenceChange={onExecutionPreferenceChange}
                        onBaseUrlOverrideChange={(baseUrlOverrideInput) => {
                            setDraftState((current) => ({
                                ...current,
                                baseUrlOverrideInput,
                            }));
                        }}
                        onSaveBaseUrlOverride={saveBaseUrlOverride}
                    />
                </div>
            </div>
        </section>
    );
}
