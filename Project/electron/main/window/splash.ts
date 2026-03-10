import { BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';

import { resolveRuntimeAssetPath } from '@/app/main/runtime/assets';

export type SplashPhase = 'starting' | 'delayed';

export interface SplashWindowOptions {
    appPath: string;
    isPackaged: boolean;
    resourcesPath?: string;
}

function getSplashSubtitle(phase: SplashPhase): string {
    return phase === 'delayed'
        ? 'Still starting. Preparing the workspace and runtime.'
        : 'Preparing the workspace and loading your agent shell.';
}

export function resolveSplashAssetPath(input: {
    appPath: string;
    isPackaged: boolean;
    resourcesPath?: string;
}): string {
    return resolveRuntimeAssetPath({
        isPackaged: input.isPackaged,
        appPath: input.appPath,
        relativePath: input.isPackaged ? 'assets/appicon.png' : 'src/assets/appicon.png',
        ...(input.resourcesPath ? { resourcesPath: input.resourcesPath } : {}),
    });
}

function readSplashImageDataUrl(assetPath: string): string {
    const bytes = readFileSync(assetPath);
    return `data:image/png;base64,${bytes.toString('base64')}`;
}

export function buildSplashHtml(input: {
    imageDataUrl: string;
    phase: SplashPhase;
}): string {
    const subtitle = getSplashSubtitle(input.phase);

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NeonConductor</title>
    <style>
        :root {
            color-scheme: dark;
            --surface: #090b12;
            --surface-elevated: rgba(255, 255, 255, 0.06);
            --border: rgba(255, 255, 255, 0.12);
            --text: #f6f7fb;
            --muted: rgba(231, 235, 244, 0.72);
            --accent: #7dd3fc;
            --accent-soft: rgba(125, 211, 252, 0.18);
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            overflow: hidden;
            background:
                radial-gradient(circle at top, rgba(125, 211, 252, 0.16), transparent 42%),
                linear-gradient(180deg, #0a0d17 0%, var(--surface) 100%);
            font-family: "Segoe UI Variable Text", "Aptos", "Segoe UI", sans-serif;
            color: var(--text);
        }

        body::before {
            content: "";
            position: fixed;
            inset: 20px;
            border-radius: 28px;
            border: 1px solid rgba(255, 255, 255, 0.04);
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 28%);
            pointer-events: none;
        }

        main {
            width: min(360px, calc(100vw - 40px));
            padding: 34px 28px 28px;
            border-radius: 30px;
            border: 1px solid var(--border);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
                rgba(9, 11, 18, 0.88);
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
            backdrop-filter: blur(14px);
            text-align: center;
        }

        .mascot-shell {
            width: 196px;
            height: 232px;
            margin: 0 auto 22px;
            display: grid;
            place-items: center;
            overflow: hidden;
        }

        .mascot-shell img {
            width: 168px;
            height: 212px;
            object-fit: contain;
            filter: drop-shadow(0 18px 42px rgba(0, 0, 0, 0.34));
            animation: mascotFloat 3.8s ease-in-out infinite;
        }

        h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 650;
            letter-spacing: 0.02em;
        }

        p {
            margin: 10px auto 0;
            max-width: 280px;
            font-size: 13px;
            line-height: 1.55;
            color: var(--muted);
        }

        .progress {
            width: 100%;
            height: 6px;
            margin-top: 24px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.07);
        }

        .progress::before {
            content: "";
            display: block;
            width: 42%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.92));
            animation: progressSweep 1.5s ease-in-out infinite;
        }

        @keyframes mascotFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-5px); }
        }

        @keyframes progressSweep {
            0% { transform: translateX(-126%); }
            100% { transform: translateX(316%); }
        }
    </style>
</head>
<body data-phase="${input.phase}">
    <main>
        <div class="mascot-shell">
            <img src="${input.imageDataUrl}" alt="NeonConductor mascot" />
        </div>
        <h1>NeonConductor</h1>
        <p id="splash-subtitle">${subtitle}</p>
        <div class="progress" aria-hidden="true"></div>
    </main>
    <script>
        (() => {
            const subtitles = {
                starting: ${JSON.stringify(getSplashSubtitle('starting'))},
                delayed: ${JSON.stringify(getSplashSubtitle('delayed'))},
            };

            window.__setSplashPhase = (phase) => {
                const nextPhase = phase === 'delayed' ? 'delayed' : 'starting';
                const subtitle = document.getElementById('splash-subtitle');
                document.body.dataset.phase = nextPhase;
                if (subtitle) {
                    subtitle.textContent = subtitles[nextPhase];
                }
                return true;
            };
        })();
    </script>
</body>
</html>`;
}

function toHtmlDataUrl(html: string): string {
    return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}

function loadSplashWindowHtml(
    splashWindow: BrowserWindow,
    options: SplashWindowOptions,
    phase: SplashPhase
): Promise<void> {
    const assetPath = resolveSplashAssetPath({
        appPath: options.appPath,
        isPackaged: options.isPackaged,
        ...(options.resourcesPath ? { resourcesPath: options.resourcesPath } : {}),
    });
    const imageDataUrl = readSplashImageDataUrl(assetPath);

    return splashWindow.loadURL(
        toHtmlDataUrl(
            buildSplashHtml({
                imageDataUrl,
                phase,
            })
        )
    );
}

export function updateSplashWindowPhase(
    splashWindow: BrowserWindow,
    options: SplashWindowOptions,
    phase: SplashPhase
): Promise<void> {
    return splashWindow.webContents
        .executeJavaScript(`window.__setSplashPhase?.(${JSON.stringify(phase)}) ?? false`, true)
        .then((updated) => {
            if (updated === true) {
                return;
            }

            return loadSplashWindowHtml(splashWindow, options, phase);
        })
        .catch(() => loadSplashWindowHtml(splashWindow, options, phase));
}

export function createSplashWindow(options: SplashWindowOptions): BrowserWindow {
    const assetPath = resolveSplashAssetPath({
        appPath: options.appPath,
        isPackaged: options.isPackaged,
        ...(options.resourcesPath ? { resourcesPath: options.resourcesPath } : {}),
    });

    const splashWindow = new BrowserWindow({
        width: 400,
        height: 480,
        minWidth: 400,
        minHeight: 480,
        maxWidth: 400,
        maxHeight: 480,
        show: false,
        frame: false,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        center: true,
        backgroundColor: '#090b12',
        icon: assetPath,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: false,
        },
    });

    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });
    splashWindow.removeMenu();

    void loadSplashWindowHtml(splashWindow, options, 'starting');

    return splashWindow;
}
