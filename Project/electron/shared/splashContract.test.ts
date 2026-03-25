import { describe, expect, it } from 'vitest';

import {
    BOOT_STUCK_WARNING_DEV_MS,
    createBootStatusSnapshot,
    getBootBlockingPrerequisiteLabel,
    getBootStatusSignature,
    INITIAL_BOOT_STATUS_SNAPSHOT,
    isBootStatusSnapshot,
} from '@/app/shared/splashContract';

describe('splashContract', () => {
    it('creates stable snapshots with default stage messaging', () => {
        expect(
            createBootStatusSnapshot({
                stage: 'profile_resolving',
                source: 'renderer',
                elapsedMs: 1250,
                blockingPrerequisite: 'resolved_profile',
            })
        ).toMatchObject({
            stage: 'profile_resolving',
            source: 'renderer',
            elapsedMs: 1250,
            isStuck: false,
            blockingPrerequisite: 'resolved_profile',
            headline: 'Resolving the active profile',
            detail: 'Resolving the active workspace profile.',
        });
    });

    it('describes stuck and forced-handoff states with the blocking prerequisite', () => {
        expect(
            createBootStatusSnapshot({
                stage: 'boot_stuck',
                source: 'main',
                elapsedMs: 4000,
                isStuck: true,
                blockingPrerequisite: 'shell_bootstrap',
            }).detail
        ).toBe('Still waiting on: shell bootstrap data. Startup time can vary depending on hardware performance.');

        expect(
            createBootStatusSnapshot({
                stage: 'handoff_forced',
                source: 'main',
                elapsedMs: 12000,
                isStuck: true,
                blockingPrerequisite: 'shell_bootstrap',
            }).detail
        ).toBe('Forced the main window open while waiting on: shell bootstrap data.');
    });

    it('uses the dev warning threshold constant for slow cold local startup tolerance', () => {
        expect(BOOT_STUCK_WARNING_DEV_MS).toBeGreaterThan(4000);
    });

    it('recognizes valid boot status payloads and rejects invalid ones', () => {
        expect(isBootStatusSnapshot(INITIAL_BOOT_STATUS_SNAPSHOT)).toBe(true);
        expect(
            isBootStatusSnapshot({
                stage: 'unexpected',
                headline: 'Broken',
                detail: 'Broken',
                isStuck: false,
                blockingPrerequisite: null,
                elapsedMs: 0,
                source: 'main',
            })
        ).toBe(false);
    });

    it('creates signatures that ignore elapsed time and expose stable blocker labels', () => {
        const first = createBootStatusSnapshot({
            stage: 'mode_resolving',
            source: 'renderer',
            elapsedMs: 100,
            blockingPrerequisite: 'initial_mode',
        });
        const second = createBootStatusSnapshot({
            stage: 'mode_resolving',
            source: 'renderer',
            elapsedMs: 500,
            blockingPrerequisite: 'initial_mode',
        });

        expect(getBootStatusSignature(first)).toBe(getBootStatusSignature(second));
        expect(getBootBlockingPrerequisiteLabel('renderer_ready_signal')).toBe('renderer ready handoff');
    });
});
