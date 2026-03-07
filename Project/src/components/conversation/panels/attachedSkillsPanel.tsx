import { useDeferredValue, useState } from 'react';

import { Button } from '@/web/components/ui/button';
import { trpc } from '@/web/trpc/client';

import type { EntityId, SkillfileDefinition } from '@/app/backend/runtime/contracts';

interface AttachedSkillsPanelProps {
    profileId: string;
    sessionId: EntityId<'sess'>;
    workspaceFingerprint?: string;
    attachedSkills: SkillfileDefinition[];
    missingAssetKeys: string[];
}

function ScopeBadge({ scope }: { scope: SkillfileDefinition['scope'] }) {
    const label = scope === 'workspace' ? 'Workspace' : scope === 'global' ? 'Global' : 'Session';
    return (
        <span className='bg-muted text-muted-foreground rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase'>
            {label}
        </span>
    );
}

export function AttachedSkillsPanel({
    profileId,
    sessionId,
    workspaceFingerprint,
    attachedSkills,
    missingAssetKeys,
}: AttachedSkillsPanelProps) {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim());
    const [mutationError, setMutationError] = useState<string | undefined>(undefined);
    const utils = trpc.useUtils();
    const searchQuery = trpc.registry.searchSkills.useQuery(
        {
            profileId,
            ...(deferredQuery.length > 0 ? { query: deferredQuery } : {}),
            ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        },
        {
            refetchOnWindowFocus: false,
        }
    );
    const setAttachedSkillsMutation = trpc.session.setAttachedSkills.useMutation({
        onSuccess: async () => {
            setMutationError(undefined);
            await utils.session.getAttachedSkills.invalidate({ profileId, sessionId });
        },
        onError: (error) => {
            setMutationError(error.message);
        },
    });

    const attachedAssetKeys = attachedSkills.map((skillfile) => skillfile.assetKey);
    const attachedAssetKeySet = new Set(attachedAssetKeys);
    const visibleResults = searchQuery.data?.skillfiles.slice(0, 8) ?? [];

    const applyAttachedSkills = (assetKeys: string[]) => {
        setMutationError(undefined);
        void setAttachedSkillsMutation.mutateAsync({
            profileId,
            sessionId,
            assetKeys,
        });
    };

    return (
        <section className='border-border bg-card mb-3 rounded-2xl border p-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold'>Attached Skills</p>
                    <p className='text-muted-foreground text-xs'>
                        Agent runs auto-apply resolved rules. Skills stay explicit per session.
                    </p>
                </div>
                <div className='text-muted-foreground text-right text-xs [font-variant-numeric:tabular-nums]'>
                    <p>{attachedSkills.length} attached</p>
                    <p>{searchQuery.data?.skillfiles.length ?? 0} available</p>
                </div>
            </div>

            <label className='mt-3 block'>
                <span className='sr-only'>Search skills</span>
                <input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                    }}
                    className='border-border bg-background h-11 w-full rounded-xl border px-3 text-sm'
                    placeholder='Search resolved skills by name or tag'
                />
            </label>

            {missingAssetKeys.length > 0 ? (
                <div className='border-amber-500/30 bg-amber-500/10 mt-3 rounded-xl border px-3 py-2 text-xs'>
                    Unresolved attached skills: {missingAssetKeys.join(', ')}. Any save here will prune them.
                </div>
            ) : null}
            {mutationError ? (
                <div className='text-destructive mt-3 rounded-xl border border-current/20 px-3 py-2 text-xs'>
                    {mutationError}
                </div>
            ) : null}

            <div className='mt-3 space-y-2'>
                {attachedSkills.length > 0 ? (
                    attachedSkills.map((skillfile) => (
                        <div
                            key={skillfile.assetKey}
                            className='border-border bg-background/70 flex min-h-11 items-start justify-between gap-3 rounded-xl border px-3 py-3'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='text-sm font-medium'>{skillfile.name}</p>
                                    <ScopeBadge scope={skillfile.scope} />
                                </div>
                                <p className='text-muted-foreground mt-1 text-xs'>
                                    {skillfile.description ?? skillfile.assetKey}
                                </p>
                            </div>
                            <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                disabled={setAttachedSkillsMutation.isPending}
                                aria-label={`Remove ${skillfile.name}`}
                                onClick={() => {
                                    applyAttachedSkills(
                                        attachedAssetKeys.filter((assetKey) => assetKey !== skillfile.assetKey)
                                    );
                                }}>
                                Remove
                            </Button>
                        </div>
                    ))
                ) : (
                    <p className='text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-sm'>
                        No skills attached to this session yet.
                    </p>
                )}
            </div>

            <div className='mt-4 space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                    <p className='text-sm font-semibold'>Resolved Skill Search</p>
                    {searchQuery.isFetching ? <p className='text-muted-foreground text-xs'>Refreshing…</p> : null}
                </div>

                {visibleResults.length > 0 ? (
                    visibleResults.map((skillfile) => {
                        const attached = attachedAssetKeySet.has(skillfile.assetKey);
                        return (
                            <div
                                key={skillfile.assetKey}
                                className='border-border flex min-h-11 items-start justify-between gap-3 rounded-xl border px-3 py-3'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='text-sm font-medium'>{skillfile.name}</p>
                                        <ScopeBadge scope={skillfile.scope} />
                                    </div>
                                    <p className='text-muted-foreground mt-1 text-xs'>
                                        {skillfile.description ?? skillfile.assetKey}
                                    </p>
                                </div>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={attached ? 'outline' : 'default'}
                                    disabled={attached || setAttachedSkillsMutation.isPending}
                                    aria-label={`Attach ${skillfile.name}`}
                                    onClick={() => {
                                        applyAttachedSkills([...attachedAssetKeys, skillfile.assetKey]);
                                    }}>
                                    {attached ? 'Attached' : 'Attach'}
                                </Button>
                            </div>
                        );
                    })
                ) : (
                    <p className='text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-sm'>
                        {deferredQuery.length > 0 ? 'No resolved skills match this search.' : 'No resolved skills available.'}
                    </p>
                )}
            </div>
        </section>
    );
}
