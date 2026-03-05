import { contextBudgets, runtimeResetTargets } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEnumValue,
    readObject,
    readOptionalBoolean,
    readOptionalNumber,
    readOptionalString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    ContextBudgetInput,
    RuntimeEventsSubscriptionInput,
    RuntimeResetInput,
    WindowStateSubscriptionInput,
} from '@/app/backend/runtime/contracts/types';

export function parseRuntimeEventsSubscriptionInput(input: unknown): RuntimeEventsSubscriptionInput {
    if (input === undefined) {
        return {};
    }

    const source = readObject(input, 'input');
    const afterSequence = readOptionalNumber(source.afterSequence, 'afterSequence');

    if (afterSequence !== undefined && (!Number.isInteger(afterSequence) || afterSequence < 0)) {
        throw new Error('Invalid "afterSequence": expected non-negative integer.');
    }

    return {
        ...(afterSequence !== undefined ? { afterSequence } : {}),
    };
}

export function parseWindowStateSubscriptionInput(input: unknown): WindowStateSubscriptionInput {
    if (input === undefined) {
        return {};
    }

    const source = readObject(input, 'input');
    const afterSequence = readOptionalNumber(source.afterSequence, 'afterSequence');

    if (afterSequence !== undefined && (!Number.isInteger(afterSequence) || afterSequence < 0)) {
        throw new Error('Invalid "afterSequence": expected non-negative integer.');
    }

    return {
        ...(afterSequence !== undefined ? { afterSequence } : {}),
    };
}

export function parseRuntimeResetInput(input: unknown): RuntimeResetInput {
    const source = readObject(input, 'input');

    const target = readEnumValue(source.target, 'target', runtimeResetTargets);
    const profileId = readOptionalString(source.profileId, 'profileId');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const dryRun = readOptionalBoolean(source.dryRun, 'dryRun') ?? false;
    const confirm = readOptionalBoolean(source.confirm, 'confirm');

    if (target === 'workspace' && !workspaceFingerprint) {
        throw new Error('Invalid "workspaceFingerprint": required when target is "workspace".');
    }

    if ((target === 'profile_settings' || target === 'full') && !profileId) {
        throw new Error('Invalid "profileId": required when target is "profile_settings" or "full".');
    }

    if (!dryRun && confirm !== true) {
        throw new Error('Invalid "confirm": expected true when dryRun is false.');
    }

    return {
        target,
        ...(profileId ? { profileId } : {}),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(dryRun ? { dryRun } : {}),
        ...(confirm !== undefined ? { confirm } : {}),
    };
}

export function parseContextBudgetInput(input: unknown): ContextBudgetInput {
    const source = readObject(input, 'input');
    return {
        contextBudget: readEnumValue(source.contextBudget, 'contextBudget', contextBudgets),
    };
}

export const runtimeEventsSubscriptionInputSchema = createParser(parseRuntimeEventsSubscriptionInput);
export const windowStateSubscriptionInputSchema = createParser(parseWindowStateSubscriptionInput);
export const runtimeResetInputSchema = createParser(parseRuntimeResetInput);
export const contextBudgetInputSchema = createParser(parseContextBudgetInput);
