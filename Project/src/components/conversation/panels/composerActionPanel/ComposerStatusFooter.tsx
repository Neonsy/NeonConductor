interface ComposerStatusFooterProps {
    composerFooterMessage: string;
    reasoningExplanationMessage: string;
    selectedModelCompatibilityState: 'compatible' | 'warning' | 'incompatible' | undefined;
}

export function ComposerStatusFooter({
    composerFooterMessage,
    reasoningExplanationMessage,
    selectedModelCompatibilityState,
}: ComposerStatusFooterProps) {
    return (
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div className='space-y-1'>
                <p
                    aria-live='polite'
                    className={`text-xs ${
                        selectedModelCompatibilityState === 'incompatible' ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                    {composerFooterMessage}
                </p>
                <p className='text-muted-foreground text-[11px] leading-5'>{reasoningExplanationMessage}</p>
            </div>
        </div>
    );
}
