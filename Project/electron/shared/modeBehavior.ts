import type {
    BehaviorFlag,
    ModeDefinition,
    ModeExecutionPolicy,
    RuntimeRequirementProfile,
    ToolCapability,
    WorkflowCapability,
} from '@/shared/contracts';
import { normalizeModeExecutionMetadata } from '@/shared/modeRoleCatalog';

type ModePolicyLike = Pick<
    ModeExecutionPolicy,
    | 'authoringRole'
    | 'roleTemplate'
    | 'internalModelRole'
    | 'delegatedOnly'
    | 'sessionSelectable'
    | 'planningOnly'
    | 'toolCapabilities'
    | 'workflowCapabilities'
    | 'behaviorFlags'
    | 'runtimeProfile'
>;

type ModeLike = Pick<ModeDefinition, 'topLevelTab' | 'modeKey' | 'executionPolicy'>;
type ModePolicySource = ModePolicyLike | ModeLike | undefined;

function uniqueValues<T extends string>(values: readonly T[] | undefined): T[] {
    if (!values || values.length === 0) {
        return [];
    }

    return Array.from(new Set(values));
}

function resolveModePolicy(source: ModePolicySource): ReturnType<typeof normalizeModeExecutionMetadata> {
    if (!source) {
        return normalizeModeExecutionMetadata({});
    }

    return 'executionPolicy' in source
        ? normalizeModeExecutionMetadata({
              topLevelTab: source.topLevelTab,
              modeKey: source.modeKey,
              policy: source.executionPolicy,
          })
        : normalizeModeExecutionMetadata({ policy: source });
}

export function getModeToolCapabilities(policy: ModePolicySource): ToolCapability[] {
    const resolvedPolicy = resolveModePolicy(policy);
    return uniqueValues(resolvedPolicy.toolCapabilities);
}

export function getModeWorkflowCapabilities(policy: ModePolicySource): WorkflowCapability[] {
    const resolvedPolicy = resolveModePolicy(policy);
    const workflowCapabilities = uniqueValues(resolvedPolicy.workflowCapabilities);
    if (resolvedPolicy.planningOnly && !workflowCapabilities.includes('planning')) {
        workflowCapabilities.push('planning');
    }

    return workflowCapabilities;
}

export function modeHasWorkflowCapability(
    mode: ModeLike | undefined,
    workflowCapability: WorkflowCapability
): boolean {
    return mode ? getModeWorkflowCapabilities(mode.executionPolicy).includes(workflowCapability) : false;
}

export function modeSupportsPlanningWorkflow(mode: ModeLike | undefined): boolean {
    return modeHasWorkflowCapability(mode, 'planning');
}

export function modeSupportsOrchestrationWorkflow(mode: ModeLike | undefined): boolean {
    return modeHasWorkflowCapability(mode, 'orchestration');
}

export function modeCanExecuteRuns(mode: ModeLike | undefined): boolean {
    return !modeSupportsPlanningWorkflow(mode);
}

export function getModeBehaviorFlags(policy: ModePolicySource): BehaviorFlag[] {
    const resolvedPolicy = resolveModePolicy(policy);
    const behaviorFlags = uniqueValues(resolvedPolicy.behaviorFlags);
    if (resolvedPolicy.planningOnly && !behaviorFlags.includes('read_only_execution')) {
        behaviorFlags.push('read_only_execution');
    }

    return behaviorFlags;
}

export function modeHasBehaviorFlag(mode: ModeLike | undefined, behaviorFlag: BehaviorFlag): boolean {
    return mode ? getModeBehaviorFlags(mode.executionPolicy).includes(behaviorFlag) : false;
}

export function modeUsesReadOnlyExecution(mode: ModeLike | undefined): boolean {
    return modeHasBehaviorFlag(mode, 'read_only_execution');
}

export function modeIsCheckpointEligible(mode: ModeLike | undefined): boolean {
    return modeHasBehaviorFlag(mode, 'checkpoint_eligible');
}

export function modeMutatesWorkspace(mode: ModeLike | undefined): boolean {
    return modeHasBehaviorFlag(mode, 'workspace_mutating');
}

export function modeShowsPlanArtifactSurface(mode: ModeLike | undefined): boolean {
    return modeSupportsPlanningWorkflow(mode) || modeSupportsOrchestrationWorkflow(mode);
}

export function modeRequiresNativeTools(mode: ModeLike | undefined): boolean {
    if (!mode || !modeCanExecuteRuns(mode)) {
        return false;
    }

    return getModeToolCapabilities(mode.executionPolicy).length > 0;
}

export function modeAllowsToolCapabilities(
    mode: ModeLike | undefined,
    requiredCapabilities: readonly ToolCapability[]
): boolean {
    const allowedCapabilities = new Set(mode ? getModeToolCapabilities(mode.executionPolicy) : []);
    return requiredCapabilities.every((capability) => allowedCapabilities.has(capability));
}

export function getModeRuntimeProfile(policy: ModePolicySource): RuntimeRequirementProfile | undefined {
    return resolveModePolicy(policy).runtimeProfile;
}

export function getModeAuthoringRole(policy: ModePolicySource) {
    return resolveModePolicy(policy).authoringRole;
}

export function getModeRoleTemplate(policy: ModePolicySource) {
    return resolveModePolicy(policy).roleTemplate;
}

export function getModeInternalModelRole(policy: ModePolicySource) {
    return resolveModePolicy(policy).internalModelRole;
}

export function modeIsDelegatedOnly(mode: ModeLike | undefined): boolean {
    return Boolean(mode && resolveModePolicy(mode).delegatedOnly);
}

export function modeIsSessionSelectable(mode: ModeLike | undefined): boolean {
    return Boolean(mode && resolveModePolicy(mode).sessionSelectable);
}
