import { randomUUID } from 'node:crypto';

import { getPersistence } from '@/app/backend/persistence/db';
import { modeStore, rulesetStore, skillfileStore } from '@/app/backend/persistence/stores';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type {
    ModeDefinitionRecord,
    RulesetDefinitionRecord,
    SkillfileDefinitionRecord,
} from '@/app/backend/persistence/types';
import type {
    ModeExecutionPolicy,
    RegistryScope,
    RegistrySourceKind,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';
import {
    loadRegistryAssetFiles,
    resolveRegistryPaths,
    slugifyAssetKey,
    titleCaseFromKey,
    toSourceKind,
} from '@/app/backend/runtime/services/registry/filesystem';
import type { RegistryListResolvedResult, RegistryRefreshResult } from '@/app/backend/runtime/services/registry/types';

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readTopLevelTab(value: unknown): TopLevelTab | undefined {
    return value === 'chat' || value === 'agent' || value === 'orchestrator' ? value : undefined;
}

function readTags(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const tags = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    return tags.length > 0 ? tags : undefined;
}

function modeLayerPriority(mode: ModeDefinitionRecord): number {
    if (mode.scope === 'session') {
        return 3;
    }
    if (mode.scope === 'workspace') {
        return 2;
    }
    if (mode.scope === 'global') {
        return 1;
    }

    return 0;
}

function assetLayerPriority(asset: { scope: RegistryScope }): number {
    if (asset.scope === 'session') {
        return 3;
    }
    if (asset.scope === 'workspace') {
        return 2;
    }
    if (asset.scope === 'global') {
        return 1;
    }

    return 0;
}

function compareRegistryPriority<T extends { precedence: number; updatedAt: string; scope: RegistryScope }>(
    left: T,
    right: T
): number {
    const layerDelta = assetLayerPriority(right) - assetLayerPriority(left);
    if (layerDelta !== 0) {
        return layerDelta;
    }

    const precedenceDelta = right.precedence - left.precedence;
    if (precedenceDelta !== 0) {
        return precedenceDelta;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
}

function resolveModeDefinitions(input: {
    modes: ModeDefinitionRecord[];
    topLevelTab: 'chat' | 'agent' | 'orchestrator';
    workspaceFingerprint?: string;
}): ModeDefinitionRecord[] {
    const filtered = input.modes.filter((mode) => {
        if (!mode.enabled || mode.topLevelTab !== input.topLevelTab) {
            return false;
        }
        if (mode.scope === 'workspace') {
            return mode.workspaceFingerprint === input.workspaceFingerprint;
        }
        if (mode.scope === 'global' || mode.scope === 'session') {
            return input.topLevelTab === 'agent';
        }
        return true;
    });

    const byModeKey = new Map<string, ModeDefinitionRecord>();
    for (const mode of filtered.sort(compareRegistryPriority)) {
        if (!byModeKey.has(mode.modeKey)) {
            byModeKey.set(mode.modeKey, mode);
        }
    }

    return Array.from(byModeKey.values()).sort((left, right) => {
        if (left.scope !== right.scope) {
            return modeLayerPriority(right) - modeLayerPriority(left);
        }
        if (left.precedence !== right.precedence) {
            return right.precedence - left.precedence;
        }
        return left.label.localeCompare(right.label);
    });
}

function resolveAssetDefinitions<T extends RulesetDefinitionRecord | SkillfileDefinitionRecord>(input: {
    items: T[];
    workspaceFingerprint?: string;
}): T[] {
    const filtered = input.items.filter((item) => {
        if (!item.enabled) {
            return false;
        }
        if (item.scope === 'workspace') {
            return item.workspaceFingerprint === input.workspaceFingerprint;
        }
        return true;
    });

    const byAssetKey = new Map<string, T>();
    for (const item of filtered.sort(compareRegistryPriority)) {
        const key = item.assetKey || item.name.toLowerCase();
        if (!byAssetKey.has(key)) {
            byAssetKey.set(key, item);
        }
    }

    return Array.from(byAssetKey.values()).sort((left, right) => {
        if (left.scope !== right.scope) {
            return assetLayerPriority(right) - assetLayerPriority(left);
        }
        if (left.precedence !== right.precedence) {
            return right.precedence - left.precedence;
        }
        return left.name.localeCompare(right.name);
    });
}

function mapModePrompt(bodyMarkdown: string): Record<string, unknown> {
    return {
        instructionsMarkdown: bodyMarkdown,
    };
}

interface DiscoveredModeInput {
    topLevelTab: 'agent';
    modeKey: string;
    label: string;
    assetKey: string;
    prompt: Record<string, unknown>;
    executionPolicy: ModeExecutionPolicy;
    source: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
    sourceKind: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
    originPath: string;
    description?: string;
    tags?: string[];
    enabled: boolean;
    precedence: number;
}

interface DiscoveredModeDraft extends Omit<DiscoveredModeInput, 'workspaceFingerprint' | 'description' | 'tags'> {
    workspaceFingerprint?: string | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
}

interface DiscoveredAssetInput {
    assetKey: string;
    name: string;
    bodyMarkdown: string;
    source: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
    sourceKind: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
    originPath: string;
    description?: string;
    tags?: string[];
    enabled: boolean;
    precedence: number;
}

interface DiscoveredAssetDraft extends Omit<DiscoveredAssetInput, 'workspaceFingerprint' | 'description' | 'tags'> {
    workspaceFingerprint?: string | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
}

function buildModeExecutionPolicy(input: {
    planningOnly?: boolean | undefined;
    readOnly?: boolean | undefined;
}): ModeExecutionPolicy {
    return {
        ...(input.planningOnly !== undefined ? { planningOnly: input.planningOnly } : {}),
        ...(input.readOnly !== undefined ? { readOnly: input.readOnly } : {}),
    };
}

function buildDiscoveredMode(input: DiscoveredModeDraft): DiscoveredModeInput {
    return {
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        label: input.label,
        assetKey: input.assetKey,
        prompt: input.prompt,
        executionPolicy: buildModeExecutionPolicy(input.executionPolicy),
        source: input.source,
        sourceKind: input.sourceKind,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        originPath: input.originPath,
        ...(input.description ? { description: input.description } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        enabled: input.enabled,
        precedence: input.precedence,
    };
}

function buildDiscoveredAsset(input: DiscoveredAssetDraft): DiscoveredAssetInput {
    return {
        assetKey: input.assetKey,
        name: input.name,
        bodyMarkdown: input.bodyMarkdown,
        source: input.source,
        sourceKind: input.sourceKind,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        originPath: input.originPath,
        ...(input.description ? { description: input.description } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        enabled: input.enabled,
        precedence: input.precedence,
    };
}

async function replaceDiscoveredModes(input: {
    profileId: string;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
    modes: Array<{
        topLevelTab: 'agent';
        modeKey: string;
        label: string;
        assetKey: string;
        prompt: Record<string, unknown>;
        executionPolicy: ModeExecutionPolicy;
        source: string;
        sourceKind: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
        scope: Extract<RegistryScope, 'global' | 'workspace'>;
        workspaceFingerprint?: string;
        originPath: string;
        description?: string;
        tags?: string[];
        enabled: boolean;
        precedence: number;
    }>;
}): Promise<void> {
    const { db } = getPersistence();
    const now = nowIso();
    const sourceKind = toSourceKind(input.scope);

    await db
        .deleteFrom('mode_definitions')
        .where('profile_id', '=', input.profileId)
        .where('source_kind', '=', sourceKind)
        .where((eb) =>
            input.scope === 'workspace'
                ? eb('workspace_fingerprint', '=', input.workspaceFingerprint ?? '')
                : eb('workspace_fingerprint', 'is', null)
        )
        .execute();

    if (input.modes.length === 0) {
        return;
    }

    await db
        .insertInto('mode_definitions')
        .values(
            input.modes.map((mode) => ({
                id: `mode_${mode.modeKey}_${randomUUID()}`,
                profile_id: input.profileId,
                top_level_tab: mode.topLevelTab,
                mode_key: mode.modeKey,
                label: mode.label,
                asset_key: mode.assetKey,
                prompt_json: JSON.stringify(mode.prompt),
                execution_policy_json: JSON.stringify(mode.executionPolicy),
                source: mode.source,
                source_kind: mode.sourceKind,
                scope: mode.scope,
                workspace_fingerprint: mode.workspaceFingerprint ?? null,
                origin_path: mode.originPath,
                description: mode.description ?? null,
                tags_json: JSON.stringify(mode.tags ?? []),
                enabled: mode.enabled ? 1 : 0,
                precedence: mode.precedence,
                created_at: now,
                updated_at: now,
            }))
        )
        .execute();
}

async function replaceDiscoveredRulesets(input: {
    profileId: string;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
    rulesets: Array<{
        assetKey: string;
        name: string;
        bodyMarkdown: string;
        source: string;
        sourceKind: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
        scope: Extract<RegistryScope, 'global' | 'workspace'>;
        workspaceFingerprint?: string;
        originPath: string;
        description?: string;
        tags?: string[];
        enabled: boolean;
        precedence: number;
    }>;
}): Promise<void> {
    const { db } = getPersistence();
    const now = nowIso();
    const sourceKind = toSourceKind(input.scope);

    await db
        .deleteFrom('rulesets')
        .where('profile_id', '=', input.profileId)
        .where('source_kind', '=', sourceKind)
        .where((eb) =>
            input.scope === 'workspace'
                ? eb('workspace_fingerprint', '=', input.workspaceFingerprint ?? '')
                : eb('workspace_fingerprint', 'is', null)
        )
        .execute();

    if (input.rulesets.length === 0) {
        return;
    }

    await db
        .insertInto('rulesets')
        .values(
            input.rulesets.map((ruleset) => ({
                id: `ruleset_${randomUUID()}`,
                profile_id: input.profileId,
                asset_key: ruleset.assetKey,
                scope: ruleset.scope,
                workspace_fingerprint: ruleset.workspaceFingerprint ?? null,
                name: ruleset.name,
                body_markdown: ruleset.bodyMarkdown,
                source: ruleset.source,
                source_kind: ruleset.sourceKind,
                origin_path: ruleset.originPath,
                description: ruleset.description ?? null,
                tags_json: JSON.stringify(ruleset.tags ?? []),
                enabled: ruleset.enabled ? 1 : 0,
                precedence: ruleset.precedence,
                created_at: now,
                updated_at: now,
            }))
        )
        .execute();
}

async function replaceDiscoveredSkillfiles(input: {
    profileId: string;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
    skillfiles: Array<{
        assetKey: string;
        name: string;
        bodyMarkdown: string;
        source: string;
        sourceKind: Extract<RegistrySourceKind, 'global_file' | 'workspace_file'>;
        scope: Extract<RegistryScope, 'global' | 'workspace'>;
        workspaceFingerprint?: string;
        originPath: string;
        description?: string;
        tags?: string[];
        enabled: boolean;
        precedence: number;
    }>;
}): Promise<void> {
    const { db } = getPersistence();
    const now = nowIso();
    const sourceKind = toSourceKind(input.scope);

    await db
        .deleteFrom('skillfiles')
        .where('profile_id', '=', input.profileId)
        .where('source_kind', '=', sourceKind)
        .where((eb) =>
            input.scope === 'workspace'
                ? eb('workspace_fingerprint', '=', input.workspaceFingerprint ?? '')
                : eb('workspace_fingerprint', 'is', null)
        )
        .execute();

    if (input.skillfiles.length === 0) {
        return;
    }

    await db
        .insertInto('skillfiles')
        .values(
            input.skillfiles.map((skillfile) => ({
                id: `skillfile_${randomUUID()}`,
                profile_id: input.profileId,
                asset_key: skillfile.assetKey,
                scope: skillfile.scope,
                workspace_fingerprint: skillfile.workspaceFingerprint ?? null,
                name: skillfile.name,
                body_markdown: skillfile.bodyMarkdown,
                source: skillfile.source,
                source_kind: skillfile.sourceKind,
                origin_path: skillfile.originPath,
                description: skillfile.description ?? null,
                tags_json: JSON.stringify(skillfile.tags ?? []),
                enabled: skillfile.enabled ? 1 : 0,
                precedence: skillfile.precedence,
                created_at: now,
                updated_at: now,
            }))
        )
        .execute();
}

async function buildDiscoveredAssets(input: {
    rootPath: string;
    scope: Extract<RegistryScope, 'global' | 'workspace'>;
    workspaceFingerprint?: string;
}): Promise<{
    modes: DiscoveredModeInput[];
    rulesets: DiscoveredAssetInput[];
    skillfiles: DiscoveredAssetInput[];
}> {
    const sourceKind = toSourceKind(input.scope);
    const [modeFiles, rulesetFiles, skillFiles] = await Promise.all([
        loadRegistryAssetFiles({ rootPath: input.rootPath, directory: 'modes' }),
        loadRegistryAssetFiles({ rootPath: input.rootPath, directory: 'rules' }),
        loadRegistryAssetFiles({ rootPath: input.rootPath, directory: 'skills' }),
    ]);

    const modes = modeFiles.flatMap<DiscoveredModeInput>((file) => {
        const topLevelTab = readTopLevelTab(file.parsed.attributes['topLevelTab']) ?? 'agent';
        if (topLevelTab !== 'agent') {
            return [];
        }

        const modeKey = slugifyAssetKey(readString(file.parsed.attributes['modeKey']) ?? file.relativePath).replace(
            /\//g,
            '_'
        );
        if (!modeKey) {
            return [];
        }

        return [
            buildDiscoveredMode({
                topLevelTab,
                modeKey,
                label:
                    readString(file.parsed.attributes['label']) ??
                    readString(file.parsed.attributes['name']) ??
                    titleCaseFromKey(modeKey),
                assetKey: slugifyAssetKey(
                    readString(file.parsed.attributes['assetKey']) ??
                        readString(file.parsed.attributes['key']) ??
                        file.relativePath
                ),
                prompt: mapModePrompt(file.parsed.bodyMarkdown),
                executionPolicy: buildModeExecutionPolicy({
                    planningOnly: readBoolean(file.parsed.attributes['planningOnly']),
                    readOnly: readBoolean(file.parsed.attributes['readOnly']),
                }),
                source: sourceKind,
                sourceKind,
                scope: input.scope,
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                originPath: file.absolutePath,
                ...(readString(file.parsed.attributes['description'])
                    ? { description: readString(file.parsed.attributes['description']) }
                    : {}),
                ...(readTags(file.parsed.attributes['tags']) ? { tags: readTags(file.parsed.attributes['tags']) } : {}),
                enabled: readBoolean(file.parsed.attributes['enabled']) ?? true,
                precedence: readNumber(file.parsed.attributes['precedence']) ?? 0,
            }),
        ];
    });

    const rulesets = rulesetFiles.map((file) =>
        buildDiscoveredAsset({
            assetKey: slugifyAssetKey(
                readString(file.parsed.attributes['assetKey']) ??
                    readString(file.parsed.attributes['key']) ??
                    file.relativePath
            ),
            name: readString(file.parsed.attributes['name']) ?? titleCaseFromKey(file.relativePath),
            bodyMarkdown: file.parsed.bodyMarkdown,
            source: sourceKind,
            sourceKind,
            scope: input.scope,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            originPath: file.absolutePath,
            ...(readString(file.parsed.attributes['description'])
                ? { description: readString(file.parsed.attributes['description']) }
                : {}),
            ...(readTags(file.parsed.attributes['tags']) ? { tags: readTags(file.parsed.attributes['tags']) } : {}),
            enabled: readBoolean(file.parsed.attributes['enabled']) ?? true,
            precedence: readNumber(file.parsed.attributes['precedence']) ?? 0,
        })
    );

    const skillfiles = skillFiles.map((file) =>
        buildDiscoveredAsset({
            assetKey: slugifyAssetKey(
                readString(file.parsed.attributes['assetKey']) ??
                    readString(file.parsed.attributes['key']) ??
                    file.relativePath
            ),
            name: readString(file.parsed.attributes['name']) ?? titleCaseFromKey(file.relativePath),
            bodyMarkdown: file.parsed.bodyMarkdown,
            source: sourceKind,
            sourceKind,
            scope: input.scope,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            originPath: file.absolutePath,
            ...(readString(file.parsed.attributes['description'])
                ? { description: readString(file.parsed.attributes['description']) }
                : {}),
            ...(readTags(file.parsed.attributes['tags']) ? { tags: readTags(file.parsed.attributes['tags']) } : {}),
            enabled: readBoolean(file.parsed.attributes['enabled']) ?? true,
            precedence: readNumber(file.parsed.attributes['precedence']) ?? 0,
        })
    );

    return {
        modes,
        rulesets,
        skillfiles,
    };
}

export async function listResolvedRegistry(input: {
    profileId: string;
    workspaceFingerprint?: string;
}): Promise<RegistryListResolvedResult> {
    const [paths, allModes, allRulesets, allSkillfiles] = await Promise.all([
        resolveRegistryPaths(input),
        modeStore.listByProfile(input.profileId),
        rulesetStore.listByProfile(input.profileId),
        skillfileStore.listByProfile(input.profileId),
    ]);

    const globalDiscovered = {
        modes: allModes.filter((mode) => mode.scope === 'global'),
        rulesets: allRulesets.filter((ruleset) => ruleset.scope === 'global'),
        skillfiles: allSkillfiles.filter((skillfile) => skillfile.scope === 'global'),
    };
    const workspaceDiscovered = input.workspaceFingerprint
        ? {
              modes: allModes.filter(
                  (mode) => mode.scope === 'workspace' && mode.workspaceFingerprint === input.workspaceFingerprint
              ),
              rulesets: allRulesets.filter(
                  (ruleset) =>
                      ruleset.scope === 'workspace' && ruleset.workspaceFingerprint === input.workspaceFingerprint
              ),
              skillfiles: allSkillfiles.filter(
                  (skillfile) =>
                      skillfile.scope === 'workspace' && skillfile.workspaceFingerprint === input.workspaceFingerprint
              ),
          }
        : undefined;

    return {
        paths,
        discovered: {
            global: globalDiscovered,
            ...(workspaceDiscovered ? { workspace: workspaceDiscovered } : {}),
        },
        resolved: {
            modes: [
                ...resolveModeDefinitions({
                    modes: allModes,
                    topLevelTab: 'chat',
                    ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                }),
                ...resolveModeDefinitions({
                    modes: allModes,
                    topLevelTab: 'agent',
                    ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                }),
                ...resolveModeDefinitions({
                    modes: allModes,
                    topLevelTab: 'orchestrator',
                    ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                }),
            ],
            rulesets: resolveAssetDefinitions({
                items: allRulesets,
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            }),
            skillfiles: resolveAssetDefinitions({
                items: allSkillfiles,
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            }),
        },
    };
}

export async function searchResolvedSkillfiles(input: {
    profileId: string;
    query?: string;
    workspaceFingerprint?: string;
}): Promise<SkillfileDefinitionRecord[]> {
    const resolved = await listResolvedRegistry(input);
    const query = input.query?.trim().toLowerCase();
    if (!query) {
        return resolved.resolved.skillfiles;
    }

    return resolved.resolved.skillfiles.filter((skillfile) => {
        const haystacks = [
            skillfile.name,
            skillfile.description ?? '',
            ...(skillfile.tags ?? []),
        ].map((value) => value.toLowerCase());
        return haystacks.some((value) => value.includes(query));
    });
}

export async function resolveSkillfilesByAssetKeys(input: {
    profileId: string;
    assetKeys: string[];
    workspaceFingerprint?: string;
}): Promise<{ skillfiles: SkillfileDefinitionRecord[]; missingAssetKeys: string[] }> {
    const uniqueAssetKeys = Array.from(
        new Set(input.assetKeys.map((assetKey) => assetKey.trim()).filter((assetKey) => assetKey.length > 0))
    );
    if (uniqueAssetKeys.length === 0) {
        return {
            skillfiles: [],
            missingAssetKeys: [],
        };
    }

    const resolved = await listResolvedRegistry(input);
    const skillfileByAssetKey = new Map(
        resolved.resolved.skillfiles.map((skillfile) => [skillfile.assetKey, skillfile] as const)
    );

    const skillfiles: SkillfileDefinitionRecord[] = [];
    const missingAssetKeys: string[] = [];
    for (const assetKey of uniqueAssetKeys) {
        const skillfile = skillfileByAssetKey.get(assetKey);
        if (!skillfile) {
            missingAssetKeys.push(assetKey);
            continue;
        }
        skillfiles.push(skillfile);
    }

    return {
        skillfiles,
        missingAssetKeys,
    };
}

export async function refreshRegistry(input: {
    profileId: string;
    workspaceFingerprint?: string;
}): Promise<RegistryRefreshResult> {
    const paths = await resolveRegistryPaths(input);
    const globalAssets = await buildDiscoveredAssets({
        rootPath: paths.globalAssetsRoot,
        scope: 'global',
    });
    await Promise.all([
        replaceDiscoveredModes({
            profileId: input.profileId,
            scope: 'global',
            modes: globalAssets.modes,
        }),
        replaceDiscoveredRulesets({
            profileId: input.profileId,
            scope: 'global',
            rulesets: globalAssets.rulesets,
        }),
        replaceDiscoveredSkillfiles({
            profileId: input.profileId,
            scope: 'global',
            skillfiles: globalAssets.skillfiles,
        }),
    ]);

    let workspaceCounts: RegistryRefreshResult['refreshed']['workspace'] | undefined;
    if (input.workspaceFingerprint && paths.workspaceAssetsRoot) {
        const workspaceAssets = await buildDiscoveredAssets({
            rootPath: paths.workspaceAssetsRoot,
            scope: 'workspace',
            workspaceFingerprint: input.workspaceFingerprint,
        });
        await Promise.all([
            replaceDiscoveredModes({
                profileId: input.profileId,
                scope: 'workspace',
                workspaceFingerprint: input.workspaceFingerprint,
                modes: workspaceAssets.modes,
            }),
            replaceDiscoveredRulesets({
                profileId: input.profileId,
                scope: 'workspace',
                workspaceFingerprint: input.workspaceFingerprint,
                rulesets: workspaceAssets.rulesets,
            }),
            replaceDiscoveredSkillfiles({
                profileId: input.profileId,
                scope: 'workspace',
                workspaceFingerprint: input.workspaceFingerprint,
                skillfiles: workspaceAssets.skillfiles,
            }),
        ]);
        workspaceCounts = {
            modes: workspaceAssets.modes.length,
            rulesets: workspaceAssets.rulesets.length,
            skillfiles: workspaceAssets.skillfiles.length,
        };
    }

    return {
        paths,
        refreshed: {
            global: {
                modes: globalAssets.modes.length,
                rulesets: globalAssets.rulesets.length,
                skillfiles: globalAssets.skillfiles.length,
            },
            ...(workspaceCounts ? { workspace: workspaceCounts } : {}),
        },
    };
}

export async function resolveModesForTab(input: {
    profileId: string;
    topLevelTab: 'chat' | 'agent' | 'orchestrator';
    workspaceFingerprint?: string;
}): Promise<ModeDefinitionRecord[]> {
    const allModes = await modeStore.listByProfile(input.profileId);
    return resolveModeDefinitions({
        modes: allModes,
        topLevelTab: input.topLevelTab,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
}
