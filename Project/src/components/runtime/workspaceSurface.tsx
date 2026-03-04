import { useState } from 'react';

import { ConversationShell } from '@/web/components/conversation/shell';
import { SettingsSheet } from '@/web/components/settings/settingsSheet';
import { DEFAULT_PROFILE_ID } from '@/web/lib/runtime/profile';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

const TAB_OPTIONS: Array<{ id: TopLevelTab; label: string }> = [
    { id: 'chat', label: 'Chat' },
    { id: 'agent', label: 'Agent' },
    { id: 'orchestrator', label: 'Orchestrator' },
];

const FALLBACK_MODE_BY_TAB: Record<TopLevelTab, string> = {
    chat: 'chat',
    agent: 'code',
    orchestrator: 'plan',
};

export function WorkspaceSurface() {
    const profileId = DEFAULT_PROFILE_ID;
    const [topLevelTab, setTopLevelTab] = useState<TopLevelTab>('chat');
    const [showSettings, setShowSettings] = useState(false);

    const modeListQuery = trpc.mode.list.useQuery(
        {
            profileId,
            topLevelTab,
        },
        {
            refetchOnWindowFocus: false,
        }
    );
    const modeActiveQuery = trpc.mode.getActive.useQuery(
        {
            profileId,
            topLevelTab,
        },
        {
            refetchOnWindowFocus: false,
        }
    );
    const setActiveModeMutation = trpc.mode.setActive.useMutation({
        onSuccess: () => {
            void modeListQuery.refetch();
            void modeActiveQuery.refetch();
        },
    });

    const modes = modeActiveQuery.data?.modes ?? modeListQuery.data?.modes ?? [];
    const activeModeKey = modeActiveQuery.data?.activeMode.modeKey ?? FALLBACK_MODE_BY_TAB[topLevelTab];

    return (
        <section className='flex min-h-0 flex-1 flex-col'>
            <header className='border-border bg-card/35 flex items-center justify-between border-b px-3 py-2'>
                <div className='flex items-center gap-2'>
                    {TAB_OPTIONS.map((tab) => (
                        <button
                            key={tab.id}
                            type='button'
                            className={`rounded-md border px-2.5 py-1 text-sm ${
                                tab.id === topLevelTab
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-background hover:bg-accent'
                            }`}
                            onClick={() => {
                                setTopLevelTab(tab.id);
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className='flex items-center gap-2'>
                    <button
                        type='button'
                        className='border-border bg-background hover:bg-accent rounded-md border px-2.5 py-1 text-sm'
                        onClick={() => {
                            setShowSettings(true);
                        }}>
                        Settings
                    </button>
                    <span className='text-muted-foreground text-xs font-medium'>Mode</span>
                    <select
                        className='border-border bg-background h-8 min-w-[180px] rounded-md border px-2 text-sm'
                        value={activeModeKey}
                        onChange={(event) => {
                            const nextModeKey = event.target.value.trim();
                            if (!nextModeKey || setActiveModeMutation.isPending) {
                                return;
                            }

                            void setActiveModeMutation.mutateAsync({
                                profileId,
                                topLevelTab,
                                modeKey: nextModeKey,
                            });
                        }}>
                        {modes.map((mode) => (
                            <option key={mode.id} value={mode.modeKey}>
                                {mode.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <div className='min-h-0 flex-1'>
                <ConversationShell topLevelTab={topLevelTab} modeKey={activeModeKey} />
            </div>
            <SettingsSheet
                open={showSettings}
                onClose={() => {
                    setShowSettings(false);
                }}
            />
        </section>
    );
}
