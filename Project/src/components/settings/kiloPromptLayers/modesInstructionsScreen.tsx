import { SettingsFeedbackBanner } from '@/web/components/settings/shared/settingsFeedbackBanner';
import { Button } from '@/web/components/ui/button';
import { useKiloPromptLayerSettingsController } from '@/web/components/settings/kiloPromptLayers/useKiloPromptLayerSettingsController';

import { topLevelTabs, type TopLevelTab } from '@/shared/contracts';

function PromptInstructionsHeader() {
    return (
        <div className='space-y-2'>
            <p className='text-primary text-[11px] font-semibold tracking-[0.18em] uppercase'>Kilo</p>
            <div className='space-y-1'>
                <h4 className='text-xl font-semibold text-balance'>Modes &amp; Instructions</h4>
                <p className='text-muted-foreground max-w-3xl text-sm leading-6'>
                    Configure the backend-owned instruction layers that run before rules and attached skills. Built-in
                    chat, agent, and orchestrator edits are powerful and can change how the app behaves.
                </p>
            </div>
        </div>
    );
}

function PromptLayerCard(input: {
    title: string;
    description: string;
    value: string;
    isSaving: boolean;
    warning?: string;
    onChange: (value: string) => void;
    onSave: () => Promise<unknown>;
    onReset: () => Promise<unknown>;
}) {
    return (
        <section className='border-border/70 bg-card/50 space-y-4 rounded-[24px] border p-5'>
            <div className='space-y-1'>
                <h5 className='text-sm font-semibold'>{input.title}</h5>
                <p className='text-muted-foreground text-sm leading-6'>{input.description}</p>
            </div>

            {input.warning ? (
                <div className='border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-2xl border px-3 py-2 text-sm'>
                    {input.warning}
                </div>
            ) : null}

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Instructions
                </span>
                <textarea
                    value={input.value}
                    onChange={(event) => {
                        input.onChange(event.target.value);
                    }}
                    className='border-border bg-background min-h-40 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                />
            </label>

            <div className='flex flex-wrap gap-2'>
                <Button
                    type='button'
                    size='sm'
                    disabled={input.isSaving}
                    onClick={() => {
                        void input.onSave();
                    }}>
                    {input.isSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={input.isSaving}
                    onClick={() => {
                        void input.onReset();
                    }}>
                    Reset
                </Button>
            </div>
        </section>
    );
}

function BuiltInModePromptCard(input: {
    title: string;
    description: string;
    roleDefinition: string;
    customInstructions: string;
    hasOverride: boolean;
    isSaving: boolean;
    warning: string;
    onRoleDefinitionChange: (value: string) => void;
    onCustomInstructionsChange: (value: string) => void;
    onSave: () => Promise<unknown>;
    onReset: () => Promise<unknown>;
}) {
    return (
        <section className='border-border/70 bg-card/50 space-y-4 rounded-[24px] border p-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1'>
                    <h5 className='text-sm font-semibold'>{input.title}</h5>
                    <p className='text-muted-foreground text-sm leading-6'>{input.description}</p>
                </div>
                <div className='border-border/70 bg-background/80 rounded-full border px-3 py-1 text-[11px] font-medium'>
                    {input.hasOverride ? 'Override active' : 'Using shipped defaults'}
                </div>
            </div>

            <div className='border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-2xl border px-3 py-2 text-sm'>
                {input.warning}
            </div>

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Role Definition
                </span>
                <textarea
                    value={input.roleDefinition}
                    onChange={(event) => {
                        input.onRoleDefinitionChange(event.target.value);
                    }}
                    className='border-border bg-background min-h-28 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                />
            </label>

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Custom Instructions
                </span>
                <textarea
                    value={input.customInstructions}
                    onChange={(event) => {
                        input.onCustomInstructionsChange(event.target.value);
                    }}
                    className='border-border bg-background min-h-36 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                />
            </label>

            <div className='flex flex-wrap gap-2'>
                <Button
                    type='button'
                    size='sm'
                    disabled={input.isSaving}
                    onClick={() => {
                        void input.onSave();
                    }}>
                    {input.isSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={input.isSaving}
                    onClick={() => {
                        void input.onReset();
                    }}>
                    Reset
                </Button>
            </div>
        </section>
    );
}

function formatTopLevelLabel(topLevelTab: TopLevelTab): string {
    return topLevelTab === 'chat'
        ? 'Chat'
        : topLevelTab === 'agent'
          ? 'Agent'
          : 'Orchestrator';
}

function formatBuiltInModeDescription(topLevelTab: TopLevelTab, label: string): string {
    return `This shipped ${label.toLowerCase()} prompt runs inside ${formatTopLevelLabel(topLevelTab).toLowerCase()} after top-level instructions and before rules or attached skills.`;
}

export function KiloModesInstructionsScreen({ profileId }: { profileId: string }) {
    const controller = useKiloPromptLayerSettingsController(profileId);

    if (controller.query.isLoading && !controller.query.data) {
        return <p className='text-muted-foreground text-sm'>Loading prompt layers…</p>;
    }

    return (
        <div className='space-y-5'>
            <PromptInstructionsHeader />

            <SettingsFeedbackBanner message={controller.feedback.message} tone={controller.feedback.tone} />

            <div className='grid gap-5 xl:grid-cols-2'>
                <PromptLayerCard
                    title='App-Scope Global Instructions'
                    description='These instructions apply across the app before any profile, tab, mode, rule, or skill content.'
                    value={controller.appGlobal.value}
                    isSaving={controller.appGlobal.isSaving}
                    onChange={controller.appGlobal.setValue}
                    onSave={controller.appGlobal.save}
                    onReset={controller.appGlobal.reset}
                />

                <PromptLayerCard
                    title='Profile-Scope Global Instructions'
                    description='These instructions apply only to the selected profile after app-scope instructions and before built-in tab instructions.'
                    value={controller.profileGlobal.value}
                    isSaving={controller.profileGlobal.isSaving}
                    onChange={controller.profileGlobal.setValue}
                    onSave={controller.profileGlobal.save}
                    onReset={controller.profileGlobal.reset}
                />
            </div>

            <div className='space-y-3'>
                <div className='space-y-1'>
                    <h5 className='text-sm font-semibold'>Built-In Top-Level Instructions</h5>
                    <p className='text-muted-foreground text-sm leading-6'>
                        These layers sit above mode-specific prompts and below app/profile global instructions.
                    </p>
                </div>

                <div className='grid gap-5 xl:grid-cols-3'>
                    {topLevelTabs.map((topLevelTab) => (
                        <PromptLayerCard
                            key={topLevelTab}
                            title={`${formatTopLevelLabel(topLevelTab)} Instructions`}
                            description={`Shipped ${formatTopLevelLabel(topLevelTab).toLowerCase()} behavior lives here before mode-specific instructions are applied.`}
                            value={controller.topLevel.getValue(topLevelTab)}
                            isSaving={controller.topLevel.isSaving}
                            warning={`Editing built-in ${formatTopLevelLabel(topLevelTab).toLowerCase()} instructions can make the app behave differently than the shipped defaults.`}
                            onChange={(value) => {
                                controller.topLevel.setValue(topLevelTab, value);
                            }}
                            onSave={() => controller.topLevel.save(topLevelTab)}
                            onReset={() => controller.topLevel.reset(topLevelTab)}
                        />
                    ))}
                </div>
            </div>

            <div className='space-y-4'>
                <div className='space-y-1'>
                    <h5 className='text-sm font-semibold'>Built-In Mode Prompts</h5>
                    <p className='text-muted-foreground text-sm leading-6'>
                        These prompts define shipped mode-specific behavior under each run family. Editing them can make
                        the app behave unexpectedly.
                    </p>
                </div>

                {topLevelTabs.map((topLevelTab) => {
                    const items = controller.builtInModes.getItems(topLevelTab);
                    if (items.length === 0) {
                        return null;
                    }

                    return (
                        <div key={topLevelTab} className='space-y-3'>
                            <div className='space-y-1'>
                                <h6 className='text-sm font-semibold'>{formatTopLevelLabel(topLevelTab)} Modes</h6>
                                <p className='text-muted-foreground text-sm leading-6'>
                                    Reset any edited built-in mode to restore the shipped default prompt for that mode.
                                </p>
                            </div>

                            <div className='grid gap-5 xl:grid-cols-2'>
                                {items.map((mode) => (
                                    <BuiltInModePromptCard
                                        key={`${mode.topLevelTab}:${mode.modeKey}`}
                                        title={mode.label}
                                        description={formatBuiltInModeDescription(topLevelTab, mode.label)}
                                        roleDefinition={mode.prompt.roleDefinition ?? ''}
                                        customInstructions={mode.prompt.customInstructions ?? ''}
                                        hasOverride={mode.hasOverride}
                                        isSaving={controller.builtInModes.isSaving}
                                        warning={`Editing the built-in ${mode.label.toLowerCase()} prompt can make the app behave unexpectedly. Reset restores the shipped behavior.`}
                                        onRoleDefinitionChange={(value) => {
                                            controller.builtInModes.setPromptField(
                                                topLevelTab,
                                                mode.modeKey,
                                                'roleDefinition',
                                                value
                                            );
                                        }}
                                        onCustomInstructionsChange={(value) => {
                                            controller.builtInModes.setPromptField(
                                                topLevelTab,
                                                mode.modeKey,
                                                'customInstructions',
                                                value
                                            );
                                        }}
                                        onSave={() => controller.builtInModes.save(topLevelTab, mode.modeKey)}
                                        onReset={() => controller.builtInModes.reset(topLevelTab, mode.modeKey)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
