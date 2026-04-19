import { ModesInstructionsScreen } from '@/web/components/settings/modesSettings/modesInstructionsScreen';
import type { ModesSettingsSubsectionId } from '@/web/components/settings/settingsNavigation';
import { SettingsContentScaffold } from '@/web/components/settings/shared/settingsContentScaffold';

interface ModesSettingsViewProps {
    profileId: string;
    subsection?: ModesSettingsSubsectionId;
    onSubsectionChange?: (subsection: ModesSettingsSubsectionId) => void;
    workspaceFingerprint?: string;
    selectedWorkspaceLabel?: string;
}

export function ModesSettingsView({
    profileId,
    workspaceFingerprint,
    selectedWorkspaceLabel,
}: ModesSettingsViewProps) {
    return (
        <SettingsContentScaffold
            eyebrow='Modes & Instructions'
            title='Shared Modes & Instructions'
            description='Manage prompt layers, role-driven custom modes, delegated worker inventories, and draft-first mode promotion without mounting a second settings rail.'
            contentClassName='max-w-6xl'>
            <ModesInstructionsScreen
                profileId={profileId}
                {...(workspaceFingerprint ? { workspaceFingerprint } : {})}
                {...(selectedWorkspaceLabel ? { selectedWorkspaceLabel } : {})}
            />
        </SettingsContentScaffold>
    );
}
