import { useState } from 'react';

import { trpc } from '@/web/trpc/client';

import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { ProviderListItem } from '@/app/backend/providers/service/types';
import type { RuntimeProviderId, TopLevelTab } from '@/shared/contracts';

interface UseSidebarWorkspaceCreateControllerInput {
    profileId: string;
    providers: Array<Pick<ProviderListItem, 'id' | 'label'>>;
    providerModels: ProviderModelRecord[];
    workspacePreferences: Array<{
        workspaceFingerprint: string;
        defaultTopLevelTab?: TopLevelTab;
        defaultProviderId?: RuntimeProviderId;
        defaultModelId?: string;
    }>;
    defaults:
        | {
              providerId: string;
              modelId: string;
          }
        | undefined;
    desktopBridge: typeof window.neonDesktop | undefined;
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
    onStarterThreadFallback: (workspaceFingerprint: string) => void;
}

function readSidebarWorkspaceBrowseErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Workspace directory could not be selected.';
}

export async function browseSidebarWorkspaceDirectory(input: {
    desktopBridge: typeof window.neonDesktop | undefined;
    isPickingWorkspaceDirectory: boolean;
    onPickingWorkspaceDirectoryChange: (isPicking: boolean) => void;
    onWorkspaceCreateErrorChange: (message: string | undefined) => void;
}): Promise<string | undefined> {
    if (!input.desktopBridge || input.isPickingWorkspaceDirectory) {
        return undefined;
    }

    input.onWorkspaceCreateErrorChange(undefined);
    input.onPickingWorkspaceDirectoryChange(true);
    try {
        const result = await input.desktopBridge.pickDirectory();
        return result.canceled ? undefined : result.absolutePath;
    } catch (error) {
        input.onWorkspaceCreateErrorChange(readSidebarWorkspaceBrowseErrorMessage(error));
        return undefined;
    } finally {
        input.onPickingWorkspaceDirectoryChange(false);
    }
}

export function useSidebarWorkspaceCreateController(input: UseSidebarWorkspaceCreateControllerInput) {
    const utils = trpc.useUtils();
    const [isWorkspaceCreateOpen, setIsWorkspaceCreateOpen] = useState(false);
    const [workspaceCreateError, setWorkspaceCreateError] = useState<string | undefined>(undefined);
    const [isPickingWorkspaceDirectory, setIsPickingWorkspaceDirectory] = useState(false);
    const registerWorkspaceRootMutation = trpc.runtime.registerWorkspaceRoot.useMutation();
    const setWorkspacePreferenceMutation = trpc.runtime.setWorkspacePreference.useMutation({
        onSuccess: ({ workspacePreference }) => {
            utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, (current) =>
                current
                    ? {
                          ...current,
                          workspacePreferences: [
                              workspacePreference,
                              ...current.workspacePreferences.filter(
                                  (record) => record.workspaceFingerprint !== workspacePreference.workspaceFingerprint
                              ),
                          ],
                      }
                    : current
            );
        },
    });

    return {
        open: isWorkspaceCreateOpen,
        busy: registerWorkspaceRootMutation.isPending || setWorkspacePreferenceMutation.isPending,
        isPickingDirectory: isPickingWorkspaceDirectory,
        statusMessage: workspaceCreateError,
        providers: input.providers,
        providerModels: input.providerModels,
        workspacePreferences: input.workspacePreferences,
        defaults: input.defaults,
        openWorkspaceCreate() {
            setWorkspaceCreateError(undefined);
            setIsWorkspaceCreateOpen(true);
        },
        closeWorkspaceCreate() {
            setWorkspaceCreateError(undefined);
            setIsWorkspaceCreateOpen(false);
        },
        async browseDirectory() {
            return await browseSidebarWorkspaceDirectory({
                desktopBridge: input.desktopBridge,
                isPickingWorkspaceDirectory,
                onPickingWorkspaceDirectoryChange: setIsPickingWorkspaceDirectory,
                onWorkspaceCreateErrorChange: setWorkspaceCreateError,
            });
        },
        async submitWorkspaceCreate(workspaceInput: {
            absolutePath: string;
            label: string;
            defaultTopLevelTab: TopLevelTab;
            defaultProviderId: RuntimeProviderId | undefined;
            defaultModelId: string;
        }) {
            setWorkspaceCreateError(undefined);
            input.onFeedbackMessageChange(undefined);
            try {
                const result = await registerWorkspaceRootMutation.mutateAsync({
                    profileId: input.profileId,
                    absolutePath: workspaceInput.absolutePath,
                    label: workspaceInput.label,
                });

                utils.runtime.listWorkspaceRoots.setData({ profileId: input.profileId }, (current) => ({
                    workspaceRoots: current
                        ? [
                              result.workspaceRoot,
                              ...current.workspaceRoots.filter(
                                  (workspaceRoot) =>
                                      workspaceRoot.fingerprint !== result.workspaceRoot.fingerprint
                              ),
                          ]
                        : [result.workspaceRoot],
                }));
                utils.runtime.getShellBootstrap.setData({ profileId: input.profileId }, (current) =>
                    current
                        ? {
                              ...current,
                              workspaceRoots: [
                                  result.workspaceRoot,
                                  ...current.workspaceRoots.filter(
                                      (workspaceRoot) =>
                                          workspaceRoot.fingerprint !== result.workspaceRoot.fingerprint
                                  ),
                              ],
                          }
                        : current
                );

                await setWorkspacePreferenceMutation.mutateAsync({
                    profileId: input.profileId,
                    workspaceFingerprint: result.workspaceRoot.fingerprint,
                    defaultTopLevelTab: workspaceInput.defaultTopLevelTab,
                    ...(workspaceInput.defaultProviderId
                        ? {
                              defaultProviderId: workspaceInput.defaultProviderId,
                              defaultModelId: workspaceInput.defaultModelId,
                          }
                        : {}),
                });

                input.onSelectWorkspaceFingerprint(result.workspaceRoot.fingerprint);
                setIsWorkspaceCreateOpen(false);
                try {
                    await input.onCreateThread({
                        workspaceFingerprint: result.workspaceRoot.fingerprint,
                        workspaceAbsolutePath: result.workspaceRoot.absolutePath,
                        title: '',
                        topLevelTab: workspaceInput.defaultTopLevelTab,
                        ...(workspaceInput.defaultProviderId && workspaceInput.defaultModelId
                            ? {
                                  providerId: workspaceInput.defaultProviderId,
                                  modelId: workspaceInput.defaultModelId,
                              }
                            : {}),
                    });
                } catch (error) {
                    input.onFeedbackMessageChange(
                        error instanceof Error
                            ? error.message
                            : 'Workspace was created, but the starter thread could not be created.'
                    );
                    input.onStarterThreadFallback(result.workspaceRoot.fingerprint);
                }
            } catch (error) {
                setWorkspaceCreateError(
                    error instanceof Error ? error.message : 'Workspace could not be created.'
                );
            }
        },
    };
}
