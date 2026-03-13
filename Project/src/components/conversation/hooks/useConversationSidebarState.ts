import { useEffect, useState } from 'react';

import type { TopLevelTab } from '@/shared/contracts';
import type { RuntimeProviderId } from '@/shared/contracts';

interface CreateThreadInput {
    topLevelTab: TopLevelTab;
    scope: 'detached' | 'workspace';
    workspacePath?: string;
    title: string;
    providerId?: RuntimeProviderId;
    modelId?: string;
}

interface UseConversationSidebarStateInput {
    topLevelTab: TopLevelTab;
    isCreatingThread: boolean;
    workspaceRoots: Array<{ fingerprint: string; absolutePath: string }>;
    preferredWorkspaceFingerprint?: string;
    preferredProviderId?: RuntimeProviderId;
    preferredModelId?: string;
    onCreateThread: (input: CreateThreadInput) => Promise<void>;
}

function modeLabel(topLevelTab: TopLevelTab): string {
    if (topLevelTab === 'chat') {
        return 'Chat';
    }
    if (topLevelTab === 'agent') {
        return 'Agent';
    }
    return 'Orchestrator';
}

export function useConversationSidebarState(input: UseConversationSidebarStateInput) {
    const initialWorkspaceFingerprint = input.preferredWorkspaceFingerprint ?? input.workspaceRoots[0]?.fingerprint;
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newThreadTopLevelTab, setNewThreadTopLevelTab] = useState<TopLevelTab>(input.topLevelTab);
    const [newThreadScope, setNewThreadScope] = useState<'detached' | 'workspace'>(
        input.topLevelTab === 'chat'
            ? initialWorkspaceFingerprint
                ? 'workspace'
                : 'detached'
            : 'workspace'
    );
    const [newThreadWorkspaceFingerprint, setNewThreadWorkspaceFingerprint] = useState<string | undefined>(
        initialWorkspaceFingerprint
    );
    const [newThreadProviderId, setNewThreadProviderId] = useState<RuntimeProviderId | undefined>(undefined);
    const [newThreadModelId, setNewThreadModelId] = useState<string | undefined>(undefined);

    useEffect(() => {
        setNewThreadTopLevelTab(input.topLevelTab);
    }, [input.topLevelTab]);

    useEffect(() => {
        setNewThreadProviderId(input.preferredProviderId);
    }, [input.preferredProviderId]);

    useEffect(() => {
        setNewThreadModelId(input.preferredModelId);
    }, [input.preferredModelId]);

    useEffect(() => {
        if (
            newThreadWorkspaceFingerprint &&
            input.workspaceRoots.some((workspaceRoot) => workspaceRoot.fingerprint === newThreadWorkspaceFingerprint)
        ) {
            return;
        }

        setNewThreadWorkspaceFingerprint(input.preferredWorkspaceFingerprint ?? input.workspaceRoots[0]?.fingerprint);
    }, [input.preferredWorkspaceFingerprint, input.workspaceRoots, newThreadWorkspaceFingerprint]);

    useEffect(() => {
        if (newThreadTopLevelTab === 'chat') {
            return;
        }

        setNewThreadScope('workspace');
    }, [newThreadTopLevelTab]);

    async function createThread(): Promise<void> {
        if (input.isCreatingThread) {
            return;
        }

        const generatedTitle =
            newThreadTitle.trim().length > 0
                ? newThreadTitle.trim()
                : `New ${modeLabel(newThreadTopLevelTab).toLowerCase()} thread`;
        const selectedWorkspace = newThreadWorkspaceFingerprint
            ? input.workspaceRoots.find((workspaceRoot) => workspaceRoot.fingerprint === newThreadWorkspaceFingerprint)
            : undefined;

        if (newThreadScope === 'workspace' && !selectedWorkspace?.absolutePath) {
            return;
        }
        if (newThreadScope === 'detached' && newThreadTopLevelTab !== 'chat') {
            return;
        }

        await input.onCreateThread({
            topLevelTab: newThreadTopLevelTab,
            scope: newThreadScope,
            title: generatedTitle,
            ...(newThreadScope === 'workspace' && selectedWorkspace?.absolutePath
                ? { workspacePath: selectedWorkspace.absolutePath }
                : {}),
            ...(newThreadProviderId && newThreadModelId
                ? {
                      providerId: newThreadProviderId,
                      modelId: newThreadModelId,
                  }
                : {}),
        });
        setNewThreadTitle('');
        setNewThreadProviderId(input.preferredProviderId);
        setNewThreadModelId(input.preferredModelId);
    }

    return {
        newThreadTitle,
        setNewThreadTitle,
        newThreadTopLevelTab,
        setNewThreadTopLevelTab,
        newThreadScope,
        setNewThreadScope,
        newThreadWorkspaceFingerprint,
        setNewThreadWorkspaceFingerprint,
        newThreadProviderId,
        setNewThreadProviderId,
        newThreadModelId,
        setNewThreadModelId,
        createThread,
    };
}

