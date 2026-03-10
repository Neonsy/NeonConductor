import { describe, expect, it } from 'vitest';

import { resolveSelectedDiffPath } from '@/web/components/conversation/panels/diffCheckpointPanelState';

describe('resolveSelectedDiffPath', () => {
    it('keeps the preferred path while it still exists and falls back when it disappears', () => {
        const selectedDiff = {
            id: 'diff_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            runId: 'run_1',
            summary: 'Diff',
            artifact: {
                kind: 'git',
                workspaceRootPath: 'C:\\workspace',
                fileCount: 2,
                files: [
                    { path: 'src/app.ts', status: 'modified' },
                    { path: 'src/lib.ts', status: 'added' },
                ],
            },
            createdAt: '2026-03-10T10:00:00.000Z',
            updatedAt: '2026-03-10T10:00:00.000Z',
        } as const;

        expect(
            resolveSelectedDiffPath({
                selectedDiff: selectedDiff as never,
                preferredPath: 'src/lib.ts',
            })
        ).toBe('src/lib.ts');

        expect(
            resolveSelectedDiffPath({
                selectedDiff: {
                    ...selectedDiff,
                    artifact: {
                        ...selectedDiff.artifact,
                        fileCount: 1,
                        files: [{ path: 'src/app.ts', status: 'modified' }],
                    },
                } as never,
                preferredPath: 'src/lib.ts',
            })
        ).toBe('src/app.ts');
    });
});
