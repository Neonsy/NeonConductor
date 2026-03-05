import { Button } from '@/web/components/ui/button';

interface ProviderOption {
    id: string;
    label: string;
    authState: string;
}

interface ModelOption {
    id: string;
    label: string;
    price?: number;
    latency?: number;
    tps?: number;
}

interface ComposerActionPanelProps {
    prompt: string;
    disabled: boolean;
    isSubmitting: boolean;
    selectedProviderId: string | undefined;
    selectedModelId: string | undefined;
    providerOptions: ProviderOption[];
    modelOptions: ModelOption[];
    runErrorMessage: string | undefined;
    onProviderChange: (providerId: string) => void;
    onModelChange: (modelId: string) => void;
    onPromptChange: (nextPrompt: string) => void;
    onSubmitPrompt: () => void;
}

export function ComposerActionPanel({
    prompt,
    disabled,
    isSubmitting,
    selectedProviderId,
    selectedModelId,
    providerOptions,
    modelOptions,
    runErrorMessage,
    onProviderChange,
    onModelChange,
    onPromptChange,
    onSubmitPrompt,
}: ComposerActionPanelProps) {
    return (
        <form
            className='border-border mt-3 space-y-2 border-t pt-3'
            onSubmit={(event) => {
                event.preventDefault();
                onSubmitPrompt();
            }}>
            <div className='grid grid-cols-2 gap-2'>
                <select
                    value={selectedProviderId ?? ''}
                    onChange={(event) => {
                        onProviderChange(event.target.value);
                    }}
                    className='border-border bg-background h-9 rounded-md border px-2 text-xs'
                    disabled={disabled || providerOptions.length === 0}>
                    <option value='' disabled>
                        Select provider
                    </option>
                    {providerOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                            {provider.label} ({provider.authState})
                        </option>
                    ))}
                </select>
                <select
                    value={selectedModelId ?? ''}
                    onChange={(event) => {
                        onModelChange(event.target.value);
                    }}
                    className='border-border bg-background h-9 rounded-md border px-2 text-xs'
                    disabled={disabled || modelOptions.length === 0}>
                    <option value='' disabled>
                        Select model
                    </option>
                    {modelOptions.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.label}
                        </option>
                    ))}
                </select>
            </div>
            {runErrorMessage ? <p className='text-destructive text-xs'>{runErrorMessage}</p> : null}
            <textarea
                value={prompt}
                onChange={(event) => {
                    onPromptChange(event.target.value);
                }}
                rows={3}
                className='border-border bg-background w-full resize-y rounded-md border p-2 text-sm'
                placeholder='Prompt for selected session...'
            />
            <div className='flex justify-end'>
                <Button type='submit' size='sm' disabled={disabled || isSubmitting || prompt.trim().length === 0}>
                    Start Run
                </Button>
            </div>
        </form>
    );
}
