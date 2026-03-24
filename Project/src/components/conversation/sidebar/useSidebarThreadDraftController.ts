import { useState } from 'react';

import { resolveThreadDraftDefaults } from '@/web/components/conversation/sidebar/threadDraftDefaults';

import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { ProviderListItem } from '@/app/backend/providers/service/types';
import type { WorkspacePreferenceRecord } from '@/app/backend/runtime/contracts/types/runtime';
import type { RuntimeProviderId, TopLevelTab } from '@/shared/contracts';

interface UseSidebarThreadDraftControllerInput {
    preferredWorkspaceFingerprint: string | undefined;
    workspaceRoots: Array<{
        fingerprint: string;
        label: string;
        absolutePath: string;
    }>;
    workspacePreferences: WorkspacePreferenceRecord[];
    providers: ProviderListItem[];
    providerModels: ProviderModelRecord[];
    defaults:
        | {
              providerId: string;
              modelId: string;
          }
        | undefined;
    onSelectWorkspaceFingerprint: (workspaceFingerprint: string | undefined) => void;
    onCreateThread: (input: {
        workspaceFingerprint: string;
        workspaceAbsolutePath: string;
        title: string;
        topLevelTab: TopLevelTab;
        providerId?: RuntimeProviderId;
        modelId?: string;
    }) => Promise<void>;
    onFeedbackMessageChange: (message: string | undefined) => void;
}

export function useSidebarThreadDraftController(input: UseSidebarThreadDraftControllerInput) {
    const [inlineThreadDraft, setInlineThreadDraft] = useState<
        | {
              workspaceFingerprint: string;
              title: string;
              topLevelTab: TopLevelTab;
              providerId: RuntimeProviderId | undefined;
              modelId: string;
          }
        | undefined
    >(undefined);

    const startInlineThreadDraft = (workspaceFingerprint: string | undefined) => {
        if (!workspaceFingerprint) {
            return;
        }

        const nextDefaults = resolveThreadDraftDefaults({
            workspaceFingerprint,
            workspacePreferences: input.workspacePreferences,
            providers: input.providers,
            providerModels: input.providerModels,
            defaults: input.defaults,
            fallbackTopLevelTab: 'agent',
        });
        setInlineThreadDraft({
            workspaceFingerprint,
            title: '',
            topLevelTab: nextDefaults.topLevelTab,
            providerId: nextDefaults.providerId,
            modelId: nextDefaults.modelId,
        });
        input.onSelectWorkspaceFingerprint(workspaceFingerprint);
    };

    async function submitInlineThread(): Promise<void> {
        if (!inlineThreadDraft) {
            return;
        }

        const workspaceRoot = input.workspaceRoots.find(
            (workspace) => workspace.fingerprint === inlineThreadDraft.workspaceFingerprint
        );
        if (!workspaceRoot) {
            input.onFeedbackMessageChange('Thread could not be created because the workspace is unresolved.');
            return;
        }

        input.onFeedbackMessageChange(undefined);
        try {
            await input.onCreateThread({
                workspaceFingerprint: inlineThreadDraft.workspaceFingerprint,
                workspaceAbsolutePath: workspaceRoot.absolutePath,
                title: inlineThreadDraft.title,
                topLevelTab: inlineThreadDraft.topLevelTab,
                ...(inlineThreadDraft.providerId && inlineThreadDraft.modelId
                    ? {
                          providerId: inlineThreadDraft.providerId,
                          modelId: inlineThreadDraft.modelId,
                      }
                    : {}),
            });
            setInlineThreadDraft(undefined);
        } catch (error) {
            input.onFeedbackMessageChange(
                error instanceof Error ? error.message : 'Thread could not be created.'
            );
        }
    }

    return {
        inlineThreadDraft,
        startInlineThreadDraft,
        setInlineThreadTitle(title: string) {
            setInlineThreadDraft((current) => (current ? { ...current, title } : current));
        },
        setInlineThreadTopLevelTab(topLevelTab: TopLevelTab) {
            setInlineThreadDraft((current) => (current ? { ...current, topLevelTab } : current));
        },
        setInlineThreadProvider(providerId: RuntimeProviderId | undefined, modelId: string) {
            setInlineThreadDraft((current) =>
                current
                    ? {
                          ...current,
                          providerId,
                          modelId,
                      }
                    : current
            );
        },
        setInlineThreadModel(modelId: string) {
            setInlineThreadDraft((current) => (current ? { ...current, modelId } : current));
        },
        cancelInlineThread() {
            setInlineThreadDraft(undefined);
        },
        submitInlineThread,
        getRequestWorkspaceFingerprint(workspaceFingerprint: string | undefined) {
            return workspaceFingerprint ?? input.preferredWorkspaceFingerprint;
        },
    };
}
