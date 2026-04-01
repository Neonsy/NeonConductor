import type {
    WorkspaceEnvironmentCommandAvailability,
    WorkspaceEnvironmentOverrides,
    WorkspaceEnvironmentSnapshot,
} from '@/app/backend/runtime/contracts/types/runtime';
import {
    resolveWorkspaceEnvironmentDetectedPreferences,
    resolveWorkspaceEnvironmentPreferencePolicy,
} from '@/app/backend/runtime/services/environment/workspaceEnvironmentPreferencePolicy';
import { buildWorkspaceEnvironmentNotes } from '@/app/backend/runtime/services/environment/workspaceEnvironmentNotesBuilder';

export function resolveWorkspaceEnvironmentInspection(input: {
    platform: WorkspaceEnvironmentSnapshot['platform'];
    shellFamily: WorkspaceEnvironmentSnapshot['shellFamily'];
    shellExecutable?: WorkspaceEnvironmentSnapshot['shellExecutable'];
    workspaceRootPath: string;
    baseWorkspaceRootPath?: string;
    availableCommands: WorkspaceEnvironmentCommandAvailability;
    markers: WorkspaceEnvironmentSnapshot['markers'];
    overrides: WorkspaceEnvironmentOverrides;
}): WorkspaceEnvironmentSnapshot {
    const detectedPreferences = resolveWorkspaceEnvironmentDetectedPreferences({
        markers: input.markers,
        availableCommands: input.availableCommands,
    });
    const effectivePreferences = resolveWorkspaceEnvironmentPreferencePolicy({
        detectedPreferences,
        overrides: input.overrides,
        availableCommands: input.availableCommands,
    });
    const notes = buildWorkspaceEnvironmentNotes({
        shellFamily: input.shellFamily,
        shellExecutable: input.shellExecutable,
        markers: input.markers,
        availableCommands: input.availableCommands,
        effectivePreferences,
    });

    return {
        platform: input.platform,
        shellFamily: input.shellFamily,
        ...(input.shellExecutable ? { shellExecutable: input.shellExecutable } : {}),
        workspaceRootPath: input.workspaceRootPath,
        ...(input.baseWorkspaceRootPath ? { baseWorkspaceRootPath: input.baseWorkspaceRootPath } : {}),
        markers: input.markers,
        availableCommands: input.availableCommands,
        detectedPreferences,
        effectivePreferences,
        overrides: input.overrides,
        notes,
    };
}

export const buildWorkspaceEnvironmentInspection = resolveWorkspaceEnvironmentInspection;
