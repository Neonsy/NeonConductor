import { useEffect, useEffectEvent, useState } from 'react';

import { ConversationShell } from '@/web/components/conversation/shell';
import {
    INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
    getWorkspaceBootDiagnostics,
    isWorkspaceBootReady,
} from '@/web/components/runtime/bootReadiness';
import { WorkspaceCommandPalette } from '@/web/components/runtime/workspaceCommandPalette';
import { useRendererBootReadySignal } from '@/web/components/runtime/useRendererBootReadySignal';
import { useRendererBootStatusReporter } from '@/web/components/runtime/useRendererBootStatusReporter';
import { useWorkspaceBootPrefetch } from '@/web/components/runtime/useWorkspaceBootPrefetch';
import { WorkspaceBootDiagnosticsPanel } from '@/web/components/runtime/workspaceBootDiagnosticsPanel';
import { useWorkspaceSurfaceController } from '@/web/components/runtime/workspaceSurfaceController';
import { WorkspaceSurfaceHeader } from '@/web/components/runtime/workspaceSurfaceHeader';
import { SettingsWorkspace } from '@/web/components/settings/settingsWorkspace';
import { trpc } from '@/web/trpc/client';

import { BOOT_FORCE_SHOW_MS } from '@/app/shared/splashContract';

export function WorkspaceSurface() {
    const controller = useWorkspaceSurfaceController();
    const utils = trpc.useUtils();
    useWorkspaceBootPrefetch({
        trpcUtils: utils,
    });
    const [conversationShellBootReadiness, setConversationShellBootReadiness] = useState(
        INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS
    );
    const [bootStartedAtMs] = useState(() => Date.now());
    const [bootElapsedMs, setBootElapsedMs] = useState(0);
    const bootPrerequisites = {
        hasResolvedProfile: Boolean(controller.resolvedProfileId),
        profilePending: controller.profilePending,
        hasProfiles: controller.hasProfiles,
        ...(controller.profileErrorMessage ? { profileErrorMessage: controller.profileErrorMessage } : {}),
        hasResolvedInitialMode: controller.hasResolvedInitialMode,
        modePending: controller.modePending,
        ...(controller.modeErrorMessage ? { modeErrorMessage: controller.modeErrorMessage } : {}),
        ...conversationShellBootReadiness,
        hasInteractiveShell:
            Boolean(controller.resolvedProfileId) &&
            conversationShellBootReadiness.shellBootstrapSettled &&
            !conversationShellBootReadiness.shellBootstrapErrorMessage,
    };
    const isBootReady = isWorkspaceBootReady(bootPrerequisites);
    const readySignal = useRendererBootReadySignal(isBootReady);
    const bootDiagnostics = getWorkspaceBootDiagnostics({
        ...bootPrerequisites,
        ...readySignal,
        elapsedMs: bootElapsedMs,
    });
    const showBootDiagnostics =
        bootDiagnostics.hasCriticalError ||
        (readySignal.readySignalState !== 'sent' && bootElapsedMs >= BOOT_FORCE_SHOW_MS);
    const openCommandPalette = useEffectEvent(() => {
        controller.setIsCommandPaletteOpen(true);
    });

    useRendererBootStatusReporter(bootDiagnostics.status);

    useEffect(() => {
        if (readySignal.readySignalState === 'sent') {
            return;
        }

        const intervalId = window.setInterval(() => {
            setBootElapsedMs(Date.now() - bootStartedAtMs);
        }, 250);

        setBootElapsedMs(Date.now() - bootStartedAtMs);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [bootStartedAtMs, readySignal.readySignalState]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable)
            ) {
                return;
            }

            event.preventDefault();
            openCommandPalette();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [openCommandPalette]);

    return (
        <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
            {showBootDiagnostics ? <WorkspaceBootDiagnosticsPanel status={bootDiagnostics.status} /> : null}
            <WorkspaceSurfaceHeader
                appSection={controller.appSection}
                profiles={controller.profiles}
                resolvedProfileId={controller.resolvedProfileId}
                isSwitchingProfile={controller.profileSetActiveMutation.isPending}
                onProfileChange={(profileId) => {
                    void controller.selectProfile(profileId);
                }}
                onOpenSettings={controller.openSettings}
                onOpenCommandPalette={() => {
                    openCommandPalette();
                }}
            />

            <div className='bg-background flex min-h-0 min-w-0 flex-1 overflow-hidden'>
                <div className='min-h-0 min-w-0 flex-1 overflow-hidden'>
                    {controller.resolvedProfileId ? (
                        <>
                            {controller.appSection === 'sessions' ? (
                                <ConversationShell
                                    key={controller.resolvedProfileId}
                                    profileId={controller.resolvedProfileId}
                                    profiles={controller.profiles}
                                    selectedProfileId={controller.resolvedProfileId}
                                    topLevelTab={controller.topLevelTab}
                                    {...(controller.currentWorkspaceFingerprint
                                        ? { selectedWorkspaceFingerprint: controller.currentWorkspaceFingerprint }
                                        : {})}
                                    modeKey={controller.activeModeKey}
                                    modes={controller.modes}
                                    onModeChange={(modeKey) => {
                                        void controller.selectMode(modeKey);
                                    }}
                                    onTopLevelTabChange={controller.setTopLevelTab}
                                    onSelectedWorkspaceFingerprintChange={controller.setCurrentWorkspaceFingerprint}
                                    onProfileChange={(profileId) => {
                                        void controller.selectProfile(profileId);
                                    }}
                                    onBootChromeReadyChange={setConversationShellBootReadiness}
                                />
                            ) : null}

                            {controller.appSection === 'settings' ? (
                                <SettingsWorkspace
                                    profileId={controller.resolvedProfileId}
                                    onProfileActivated={(profileId) => {
                                        controller.setResolvedProfile(profileId);
                                    }}
                                    onReturnToSessions={controller.returnToPrimarySection}
                                />
                            ) : null}
                        </>
                    ) : (
                        <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
                            Loading profile state...
                        </div>
                    )}
                </div>
            </div>

            <WorkspaceCommandPalette
                open={controller.isCommandPaletteOpen}
                appSection={controller.appSection}
                profiles={controller.profiles}
                workspaceOptions={controller.workspaceRoots.map((workspaceRoot) => ({
                    fingerprint: workspaceRoot.fingerprint,
                    label: workspaceRoot.label,
                }))}
                onClose={() => {
                    controller.setIsCommandPaletteOpen(false);
                }}
                onSectionChange={controller.setAppSection}
                onProfileChange={(profileId) => {
                    void controller.selectProfile(profileId);
                }}
                onWorkspaceChange={controller.setCurrentWorkspaceFingerprint}
            />
        </section>
    );
}
