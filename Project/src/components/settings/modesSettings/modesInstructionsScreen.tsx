import { SettingsFeedbackBanner } from '@/web/components/settings/shared/settingsFeedbackBanner';
import { Button } from '@/web/components/ui/button';
import { useModesInstructionsSettingsController } from '@/web/components/settings/modesSettings/useModesInstructionsSettingsController';

import { toolCapabilities, topLevelTabs, type ToolCapability, type TopLevelTab } from '@/shared/contracts';

function PromptInstructionsHeader() {
    return (
        <div className='space-y-2'>
            <p className='text-primary text-[11px] font-semibold tracking-[0.18em] uppercase'>App-Level Modes</p>
            <div className='space-y-1'>
                <h4 className='text-xl font-semibold text-balance'>Modes &amp; Instructions</h4>
                <p className='text-muted-foreground max-w-3xl text-sm leading-6'>
                    Configure app-level prompt layers, built-in mode overrides, and text-based portability for
                    file-backed custom modes across chat, agent, and orchestrator.
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

function formatToolCapabilityLabel(toolCapability: ToolCapability): string {
    return toolCapability
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function CustomModeEditorSection(input: {
    editor: ReturnType<typeof useModesInstructionsSettingsController>['customModes']['editor'];
}) {
    if (input.editor.isLoading && !input.editor.draft) {
        return (
            <section className='border-border/70 bg-card/50 rounded-[24px] border p-5'>
                <p className='text-sm font-semibold'>Loading custom mode…</p>
            </section>
        );
    }

    const draft = input.editor.draft;
    if (!draft) {
        return null;
    }

    return (
        <section className='border-border/70 bg-card/50 space-y-4 rounded-[24px] border p-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1'>
                    <h6 className='text-sm font-semibold'>
                        {draft.kind === 'create' ? 'Create File-Backed Custom Mode' : 'Edit File-Backed Custom Mode'}
                    </h6>
                    <p className='text-muted-foreground text-sm leading-6'>
                        {draft.kind === 'create'
                            ? 'Create a file-backed custom mode in the selected registry root.'
                            : 'Edit the existing file-backed mode in place. Scope, tab, and slug stay immutable after creation.'}
                    </p>
                </div>

                <div className='flex flex-wrap gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={input.editor.isSaving}
                        onClick={input.editor.close}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        disabled={
                            input.editor.isSaving || (draft.scope === 'workspace' && !input.editor.hasWorkspaceScope)
                        }
                        onClick={() => {
                            void input.editor.save();
                        }}>
                        {input.editor.isSaving
                            ? draft.kind === 'create'
                                ? 'Creating…'
                                : 'Saving…'
                            : draft.kind === 'create'
                              ? 'Create Mode'
                              : 'Save Mode'}
                    </Button>
                </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Scope
                    </span>
                    {draft.kind === 'create' ? (
                        <select
                            className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                            value={draft.scope}
                            onChange={(event) => {
                                input.editor.setScope(event.target.value as 'global' | 'workspace');
                            }}>
                            <option value='global'>Global</option>
                            <option value='workspace' disabled={!input.editor.hasWorkspaceScope}>
                                Workspace
                            </option>
                        </select>
                    ) : (
                        <input
                            readOnly
                            className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                            value={draft.scope === 'global' ? 'Global' : 'Workspace'}
                        />
                    )}
                </label>

                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Top-Level Tab
                    </span>
                    {draft.kind === 'create' ? (
                        <select
                            className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                            value={draft.topLevelTab}
                            onChange={(event) => {
                                input.editor.setTopLevelTab(event.target.value as TopLevelTab);
                            }}>
                            {topLevelTabs.map((topLevelTab) => (
                                <option key={topLevelTab} value={topLevelTab}>
                                    {formatTopLevelLabel(topLevelTab)}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            readOnly
                            className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                            value={formatTopLevelLabel(draft.topLevelTab)}
                        />
                    )}
                </label>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Slug
                    </span>
                    <input
                        readOnly={draft.kind === 'edit'}
                        className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                        value={draft.slug}
                        onChange={(event) => {
                            input.editor.setField('slug', event.target.value);
                        }}
                    />
                </label>

                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Name
                    </span>
                    <input
                        className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                        value={draft.name}
                        onChange={(event) => {
                            input.editor.setField('name', event.target.value);
                        }}
                    />
                </label>
            </div>

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Description
                </span>
                <textarea
                    value={draft.description}
                    onChange={(event) => {
                        input.editor.setField('description', event.target.value);
                    }}
                    className='border-border bg-background min-h-24 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                />
            </label>

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    When To Use
                </span>
                <textarea
                    value={draft.whenToUse}
                    onChange={(event) => {
                        input.editor.setField('whenToUse', event.target.value);
                    }}
                    className='border-border bg-background min-h-24 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                />
            </label>

            <label className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Tags
                </span>
                <textarea
                    value={draft.tagsText}
                    onChange={(event) => {
                        input.editor.setField('tagsText', event.target.value);
                    }}
                    className='border-border bg-background min-h-20 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                    spellCheck={false}
                    placeholder='quality, review'
                />
                <p className='text-muted-foreground text-xs leading-5'>
                    Separate tags with commas or new lines.
                </p>
            </label>

            <div className='space-y-2'>
                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                    Tool Capabilities
                </span>
                <div className='grid gap-3 md:grid-cols-2'>
                    {toolCapabilities.map((toolCapability) => (
                        <label
                            key={toolCapability}
                            className='border-border bg-background flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm'>
                            <input
                                type='checkbox'
                                className='mt-1'
                                checked={draft.selectedToolCapabilities.includes(toolCapability)}
                                onChange={() => {
                                    input.editor.toggleToolCapability(toolCapability);
                                }}
                            />
                            <span className='leading-6'>{formatToolCapabilityLabel(toolCapability)}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Role Definition
                    </span>
                    <textarea
                        value={draft.roleDefinition}
                        onChange={(event) => {
                            input.editor.setField('roleDefinition', event.target.value);
                        }}
                        className='border-border bg-background min-h-32 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                        spellCheck={false}
                    />
                </label>

                <label className='space-y-2'>
                    <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                        Custom Instructions
                    </span>
                    <textarea
                        value={draft.customInstructions}
                        onChange={(event) => {
                            input.editor.setField('customInstructions', event.target.value);
                        }}
                        className='border-border bg-background min-h-32 w-full rounded-2xl border px-4 py-3 text-sm leading-6'
                        spellCheck={false}
                    />
                </label>
            </div>

            <div className='border-border/70 bg-background/60 rounded-2xl border px-4 py-3 text-sm'>
                {draft.scope === 'workspace' ? (
                    <span>
                        Workspace target: {input.editor.selectedWorkspaceLabel ?? 'Selected workspace'}
                    </span>
                ) : (
                    <span>Target root: global <code>modes/</code></span>
                )}
            </div>

            {draft.kind === 'edit' ? (
                <div className='border-destructive/25 bg-destructive/5 space-y-3 rounded-2xl border px-4 py-4'>
                    <p className='text-sm font-semibold'>Delete This Mode</p>
                    <p className='text-muted-foreground text-sm leading-6'>
                        This deletes the file-backed mode for {draft.scope} {formatTopLevelLabel(draft.topLevelTab)}:{' '}
                        {draft.modeKey}.
                    </p>
                    <label className='flex items-start gap-3 text-sm'>
                        <input
                            type='checkbox'
                            className='mt-1'
                            checked={draft.deleteConfirmed}
                            onChange={(event) => {
                                input.editor.setDeleteConfirmed(event.target.checked);
                            }}
                        />
                        <span className='text-muted-foreground leading-6'>
                            I understand this will delete the file-backed custom mode and rely on normal fallback
                            resolution afterward.
                        </span>
                    </label>
                    <Button
                        type='button'
                        size='sm'
                        variant='destructive'
                        disabled={input.editor.isSaving || !draft.deleteConfirmed}
                        onClick={() => {
                            void input.editor.deleteMode();
                        }}>
                        {input.editor.isSaving ? 'Deleting…' : 'Delete Mode'}
                    </Button>
                </div>
            ) : null}
        </section>
    );
}

function FileBackedModeInventorySection(input: {
    scope: 'global' | 'workspace';
    itemsByTab: ReturnType<typeof useModesInstructionsSettingsController>['customModes']['global'];
    isExporting: boolean;
    onExport: (scope: 'global' | 'workspace', topLevelTab: TopLevelTab, modeKey: string) => Promise<void>;
    onEdit: (scope: 'global' | 'workspace', topLevelTab: TopLevelTab, modeKey: string) => Promise<void>;
    onDelete: (scope: 'global' | 'workspace', topLevelTab: TopLevelTab, modeKey: string) => Promise<void>;
}) {
    const hasItems = topLevelTabs.some((topLevelTab) => input.itemsByTab[topLevelTab].length > 0);
    if (!hasItems) {
        return (
            <div className='border-border/70 bg-card/40 rounded-[24px] border p-5'>
                <p className='text-sm font-semibold'>
                    No {input.scope === 'global' ? 'global' : 'workspace'} file-backed custom modes
                </p>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    Import a portable mode JSON object here to create one through the existing registry root.
                </p>
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            {topLevelTabs.map((topLevelTab) => {
                const items = input.itemsByTab[topLevelTab];
                if (items.length === 0) {
                    return null;
                }

                return (
                    <div key={`${input.scope}:${topLevelTab}`} className='space-y-3'>
                        <div className='space-y-1'>
                            <h6 className='text-sm font-semibold'>
                                {input.scope === 'global' ? 'Global' : 'Workspace'} {formatTopLevelLabel(topLevelTab)} Modes
                            </h6>
                            <p className='text-muted-foreground text-sm leading-6'>
                                These are file-backed custom modes discovered through the existing registry root.
                            </p>
                        </div>

                        <div className='grid gap-4 xl:grid-cols-2'>
                            {items.map((mode) => (
                                <article
                                    key={`${input.scope}:${mode.topLevelTab}:${mode.modeKey}`}
                                    className='border-border/70 bg-card/50 space-y-3 rounded-[24px] border p-5'>
                                    <div className='space-y-1'>
                                        <div className='flex flex-wrap items-center justify-between gap-3'>
                                            <h6 className='text-sm font-semibold'>{mode.label}</h6>
                                            <span className='border-border/70 bg-background/80 rounded-full border px-3 py-1 text-[11px] font-medium'>
                                                {formatTopLevelLabel(mode.topLevelTab)} · {mode.modeKey}
                                            </span>
                                        </div>
                                        <p className='text-muted-foreground text-sm leading-6'>
                                            {mode.description ?? 'No description set for this file-backed mode yet.'}
                                        </p>
                                        {mode.whenToUse ? (
                                            <p className='text-muted-foreground text-sm leading-6'>
                                                <span className='text-foreground font-medium'>When to use:</span>{' '}
                                                {mode.whenToUse}
                                            </p>
                                        ) : null}
                                        {mode.tags && mode.tags.length > 0 ? (
                                            <div className='flex flex-wrap gap-2 pt-1'>
                                                {mode.tags.map((tag) => (
                                                    <span
                                                        key={`${mode.modeKey}:tag:${tag}`}
                                                        className='border-border/70 bg-background/80 rounded-full border px-3 py-1 text-[11px] font-medium'>
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {mode.toolCapabilities && mode.toolCapabilities.length > 0 ? (
                                            <div className='flex flex-wrap gap-2 pt-1'>
                                                {mode.toolCapabilities.map((toolCapability) => (
                                                    <span
                                                        key={`${mode.modeKey}:tool:${toolCapability}`}
                                                        className='border-border/70 bg-background/80 rounded-full border px-3 py-1 text-[11px] font-medium'>
                                                        {formatToolCapabilityLabel(toolCapability)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={() => {
                                                void input.onEdit(input.scope, mode.topLevelTab, mode.modeKey);
                                            }}>
                                            Edit
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={() => {
                                                void input.onDelete(input.scope, mode.topLevelTab, mode.modeKey);
                                            }}>
                                            Delete
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            disabled={input.isExporting}
                                            onClick={() => {
                                                void input.onExport(input.scope, mode.topLevelTab, mode.modeKey);
                                            }}>
                                            {input.isExporting ? 'Loading…' : 'Load Export JSON'}
                                        </Button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function ModesInstructionsScreen(input: {
    profileId: string;
    workspaceFingerprint?: string;
    selectedWorkspaceLabel?: string;
}) {
    const controller = useModesInstructionsSettingsController(input);

    if (controller.query.isLoading && !controller.query.data) {
        return <p className='text-muted-foreground text-sm'>Loading mode settings…</p>;
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

            <div className='space-y-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='space-y-1'>
                        <h5 className='text-sm font-semibold'>File-Backed Custom Modes</h5>
                        <p className='text-muted-foreground text-sm leading-6'>
                            Manage app-level file-backed custom modes while keeping the registry roots as the only
                            source of truth.
                        </p>
                    </div>

                    <div className='flex flex-wrap gap-2'>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => {
                                controller.customModes.editor.openCreate('global');
                            }}>
                            Create Global Mode
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={!controller.customModes.editor.hasWorkspaceScope}
                            onClick={() => {
                                controller.customModes.editor.openCreate('workspace');
                            }}>
                            Create Workspace Mode
                        </Button>
                    </div>
                </div>

                <CustomModeEditorSection editor={controller.customModes.editor} />

                <div className='grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]'>
                    <section className='border-border/70 bg-card/50 space-y-4 rounded-[24px] border p-5'>
                        <div className='space-y-1'>
                            <h6 className='text-sm font-semibold'>Import Portable Mode JSON</h6>
                            <p className='text-muted-foreground text-sm leading-6'>
                                Supported fields: <code>slug</code>, <code>name</code>, <code>description</code>,{' '}
                                <code>roleDefinition</code>, <code>customInstructions</code>, <code>whenToUse</code>,
                                and <code>groups</code>. Portable <code>groups</code> map into Neon tool
                                capabilities during import.
                            </p>
                        </div>

                        <div className='grid gap-4 md:grid-cols-2'>
                            <label className='space-y-2'>
                                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                                    Top-Level Tab
                                </span>
                                <select
                                    className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                                    value={controller.customModes.importDraft.topLevelTab}
                                    onChange={(event) => {
                                        controller.customModes.setImportTopLevelTab(event.target.value as TopLevelTab);
                                    }}>
                                    {topLevelTabs.map((topLevelTab) => (
                                        <option key={topLevelTab} value={topLevelTab}>
                                            {formatTopLevelLabel(topLevelTab)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className='space-y-2'>
                                <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                                    Target Scope
                                </span>
                                <select
                                    className='border-border bg-background h-11 w-full rounded-2xl border px-3 text-sm'
                                    value={controller.customModes.importDraft.scope}
                                    onChange={(event) => {
                                        controller.customModes.setImportScope(event.target.value as 'global' | 'workspace');
                                    }}>
                                    <option value='global'>Global</option>
                                    <option
                                        value='workspace'
                                        disabled={!controller.customModes.importDraft.hasWorkspaceScope}>
                                        Workspace
                                    </option>
                                </select>
                            </label>
                        </div>

                        <div className='border-border/70 bg-background/60 rounded-2xl border px-4 py-3 text-sm'>
                            {controller.customModes.importDraft.hasWorkspaceScope ? (
                                controller.customModes.importDraft.scope === 'workspace' ? (
                                    <span>
                                        Workspace target: {controller.customModes.importDraft.selectedWorkspaceLabel ?? 'Selected workspace'}
                                    </span>
                                ) : (
                                    <span>Import will write into the global <code>modes/</code> registry root.</span>
                                )
                            ) : (
                                <span>Workspace import is unavailable until a workspace is selected in the app shell.</span>
                            )}
                        </div>

                        <label className='space-y-2'>
                            <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                                Portable JSON
                            </span>
                            <textarea
                                value={controller.customModes.importDraft.jsonText}
                                onChange={(event) => {
                                    controller.customModes.setImportJsonText(event.target.value);
                                }}
                                className='border-border bg-background min-h-64 w-full rounded-2xl border px-4 py-3 font-mono text-sm leading-6'
                                spellCheck={false}
                                placeholder='{\n  "slug": "review",\n  "name": "Review",\n  "description": "Workspace review mode",\n  "roleDefinition": "Act as a precise reviewer.",\n  "customInstructions": "Review the workspace carefully.",\n  "whenToUse": "Use when a change needs a strict review pass.",\n  "groups": ["read", "command"]\n}'
                            />
                        </label>

                        <label className='flex items-start gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm'>
                            <input
                                type='checkbox'
                                className='mt-1'
                                checked={controller.customModes.importDraft.allowOverwrite}
                                onChange={(event) => {
                                    controller.customModes.setAllowOverwrite(event.target.checked);
                                }}
                            />
                            <span className='text-muted-foreground leading-6'>
                                Explicitly allow overwrite if a file-backed mode with the same tab and key already
                                exists in the selected scope.
                            </span>
                        </label>

                        <div className='flex flex-wrap gap-2'>
                            <Button
                                type='button'
                                size='sm'
                                disabled={
                                    controller.customModes.isImporting ||
                                    (controller.customModes.importDraft.scope === 'workspace' &&
                                        !controller.customModes.importDraft.hasWorkspaceScope)
                                }
                                onClick={() => {
                                    void controller.customModes.importMode();
                                }}>
                                {controller.customModes.isImporting ? 'Importing…' : 'Import Mode'}
                            </Button>
                        </div>
                    </section>

                    <section className='border-border/70 bg-card/50 space-y-4 rounded-[24px] border p-5'>
                        <div className='space-y-1'>
                            <h6 className='text-sm font-semibold'>Export Portable Mode JSON</h6>
                            <p className='text-muted-foreground text-sm leading-6'>
                                Export reads from file-backed custom modes only. Built-in modes stay outside this
                                portability slice.
                            </p>
                        </div>

                        <div className='border-border/70 bg-background/60 rounded-2xl border px-4 py-3 text-sm'>
                            {controller.customModes.exportState.selectedLabel
                                ? `Selected export: ${controller.customModes.exportState.selectedLabel}`
                                : 'Choose a file-backed custom mode below to load export JSON here.'}
                        </div>

                        <label className='space-y-2'>
                            <span className='text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase'>
                                Export JSON
                            </span>
                            <textarea
                                readOnly
                                value={controller.customModes.exportState.jsonText}
                                className='border-border bg-background min-h-64 w-full rounded-2xl border px-4 py-3 font-mono text-sm leading-6'
                                spellCheck={false}
                            />
                        </label>

                        <div className='flex flex-wrap gap-2'>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={controller.customModes.exportState.jsonText.trim().length === 0}
                                onClick={() => {
                                    void controller.customModes.copyExportJson();
                                }}>
                                Copy JSON
                            </Button>
                        </div>
                    </section>
                </div>

                <FileBackedModeInventorySection
                    scope='global'
                    itemsByTab={controller.customModes.global}
                    isExporting={controller.customModes.isExporting}
                    onExport={controller.customModes.exportMode}
                    onEdit={controller.customModes.editor.openEdit}
                    onDelete={controller.customModes.editor.openDelete}
                />

                {controller.workspace.fingerprint ? (
                    <FileBackedModeInventorySection
                        scope='workspace'
                        itemsByTab={controller.customModes.workspace}
                        isExporting={controller.customModes.isExporting}
                        onExport={controller.customModes.exportMode}
                        onEdit={controller.customModes.editor.openEdit}
                        onDelete={controller.customModes.editor.openDelete}
                    />
                ) : null}
            </div>
        </div>
    );
}
