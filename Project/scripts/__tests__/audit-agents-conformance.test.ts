import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { auditAgentsConformance, hasBlockingViolations } from '../audit-agents-conformance';

function writeFixture(rootDir: string, relativePath: string, content: string): void {
    const absolutePath = path.join(rootDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
}

describe('auditAgentsConformance', () => {
    it('detects blocking AGENTS violations in handwritten source', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(rootDir, 'src/tooLarge.ts', 'const value = 1;\n'.repeat(1000));
            writeFixture(
                rootDir,
                'src/withDisable.ts',
                `// ${['eslint', 'disable-next-line'].join('-')} no-console\nconst value = 1;\n`
            );
            writeFixture(rootDir, 'src/runtime.ts', "import { describe } from 'vitest';\n");

            const report = auditAgentsConformance(rootDir);

            expect(report.oversizedHandwrittenSourceFiles).toHaveLength(1);
            expect(report.inlineLintSuppressions).toHaveLength(1);
            expect(report.nonTestFrameworkImports).toHaveLength(1);
            expect(hasBlockingViolations(report)).toBe(true);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('reports non-blocking memoization, cast, and throw candidates without counting parser files', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'src/view.tsx',
                "const value = useMemo<SomeType>(() => input as SomeType, [input]);\nthrow new Error('boom');\n"
            );
            writeFixture(
                rootDir,
                'src/runtime/contracts/parsers/example.ts',
                "export function parseValue(): never { throw new Error('invalid'); }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.nonBlockingReactMemoization).toHaveLength(1);
            expect(report.nonBlockingBroadCasts).toHaveLength(1);
            expect(report.nonBlockingThrows).toHaveLength(1);
            expect(report.nonBlockingThrows[0]?.path).toBe('src/view.tsx');
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('treats useLayoutEffect as a blocking violation in renderer source', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(rootDir, 'src/view.tsx', "function View() { useLayoutEffect(() => {}, []); return null; }\n");

            const report = auditAgentsConformance(rootDir);

            expect(report.forbiddenLayoutEffects).toHaveLength(1);
            expect(hasBlockingViolations(report)).toBe(true);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('reports suspicious effect-driven state mirroring patterns', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'src/profile.tsx',
                "function View({ selectedProfile }) { const [renameValue, setRenameValue] = useState(''); useEffect(() => { setRenameValue(selectedProfile?.name ?? ''); }, [selectedProfile?.id, selectedProfile?.name]); return renameValue; }\n"
            );
            writeFixture(
                rootDir,
                'src/context.tsx',
                "function View({ globalSettingsQuery }) { const [percent, setPercent] = useState('90'); useEffect(() => { const settings = globalSettingsQuery.data?.settings; if (!settings) { return; } setPercent(String(settings.percent)); }, [globalSettingsQuery.data?.settings]); return percent; }\n"
            );
            writeFixture(
                rootDir,
                'src/diff.tsx',
                "function View({ firstSelectablePath, selectedDiff }) { const [selectedPath, setSelectedPath] = useState(undefined); useEffect(() => { setSelectedPath(firstSelectablePath); }, [firstSelectablePath, selectedDiff?.id]); return selectedPath; }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect([...report.nonBlockingSuspiciousEffects.map((violation) => violation.path)].sort()).toEqual([
                'src/context.tsx',
                'src/diff.tsx',
                'src/profile.tsx',
            ]);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('allows keyed draft derivation without effect warnings', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'src/view.tsx',
                "function View({ selectedProfile, renameDraft }) { const renameValue = renameDraft?.profileId === selectedProfile?.id ? renameDraft.value : selectedProfile?.name ?? ''; return renameValue; }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.nonBlockingSuspiciousEffects).toEqual([]);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('allows TRPC transport-boundary throw toTrpcError patterns', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'electron/backend/trpc/routers/context/index.ts',
                "const value = result.match((ok) => ok, (error) => { throw toTrpcError(error); });\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.nonBlockingThrows).toEqual([]);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('treats renderer electron imports, non-preload bridges, and insecure BrowserWindow configs as blocking violations', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(rootDir, 'src/view.tsx', "import { shell } from 'electron';\nexport function View() { return shell; }\n");
            writeFixture(
                rootDir,
                'electron/main/runtime.ts',
                "import { ipcRenderer } from 'electron';\nexport function read() { return ipcRenderer.sendSync('ping'); }\n"
            );
            writeFixture(
                rootDir,
                'electron/main/window.ts',
                "import { BrowserWindow } from 'electron';\nexport function createWindow() { return new BrowserWindow({ webPreferences: { nodeIntegration: false } }); }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.rendererElectronImports).toHaveLength(1);
            expect(report.nonPreloadElectronBridgeUsage).toHaveLength(1);
            expect(report.insecureBrowserWindows).toHaveLength(1);
            expect(hasBlockingViolations(report)).toBe(true);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('allows preload bridge usage and hardened BrowserWindow configs', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'electron/main/preload/index.ts',
                "import { contextBridge, ipcRenderer } from 'electron';\ncontextBridge.exposeInMainWorld('bridge', { ping: () => ipcRenderer.send('ping') });\n"
            );
            writeFixture(
                rootDir,
                'electron/main/window.ts',
                "import { BrowserWindow } from 'electron';\nexport function createWindow() { return new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } }); }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.nonPreloadElectronBridgeUsage).toEqual([]);
            expect(report.insecureBrowserWindows).toEqual([]);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('reports async useEffect as a non-blocking review warning', () => {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'agents-audit-'));

        try {
            writeFixture(
                rootDir,
                'src/view.tsx',
                "function View() { useEffect(async () => { await fetch('/api'); }, []); return null; }\n"
            );

            const report = auditAgentsConformance(rootDir);

            expect(report.nonBlockingAsyncEffects).toHaveLength(1);
            expect(hasBlockingViolations(report)).toBe(false);
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });
});
