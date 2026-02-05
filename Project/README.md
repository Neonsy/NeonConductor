# Electron + Vite + React Template

> A modern, type-safe Electron starter with Vite, React 19, tRPC IPC, TanStack ecosystem, and TailwindCSS.

![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7%2B-646CFF?logo=vite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-40%2B-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19%2B-61DAFB?logo=react&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-11%2B-398CCB?logo=trpc&logoColor=white)
![TanStack Router](https://img.shields.io/badge/TanStack%20Router-1%2B-FF4154?logo=react&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5%2B-FF4154?logo=react&logoColor=white)
![TanStack Form](https://img.shields.io/badge/TanStack%20Form-1%2B-FF4154?logo=react&logoColor=white)
![TanStack Virtual](https://img.shields.io/badge/TanStack%20Virtual-3%2B-FF4154?logo=react&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4%2B-06B6D4?logo=tailwindcss&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-9%2B-4B32C3?logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-3%2B-F7B93E?logo=prettier&logoColor=white)

---

## Quickstart

```bash
pnpm install
pnpm dev          # Start Vite dev server + Electron
pnpm test         # Run unit tests
pnpm build:win    # Build and package Windows installer
pnpm build:mac    # Build and package macOS DMG
pnpm build:linux  # Build and package Linux AppImage
```

> **Note:** If pnpm blocks Electron's postinstall on a fresh machine, run `pnpm approve-builds`.

---

## Scripts

| Script                 | Description                             |
| ---------------------- | --------------------------------------- |
| `pnpm dev`             | Start Vite dev server + Electron        |
| `pnpm build`           | Build renderer only (no packaging)      |
| `pnpm build:win`       | Build and package Windows installer     |
| `pnpm build:mac`       | Build and package macOS DMG             |
| `pnpm build:linux`     | Build and package Linux AppImage        |
| `pnpm publish:generic` | Publish built app to self-hosted server |
| `pnpm lint`            | Run ESLint                              |
| `pnpm lint:fix`        | Run ESLint with auto-fix                |
| `pnpm format`          | Format code with Prettier               |
| `pnpm format:check`    | Check code formatting without modifying |
| `pnpm test`            | Run unit tests (Vitest)                 |
| `pnpm test:watch`      | Run tests in watch mode                 |

---

## Testing

This template includes a minimal Vitest setup for Electron utility modules.

```bash
pnpm test
```

## Stack Overview

### Core

- **Electron**: Desktop app shell with hardened security defaults
- **Vite**: Fast dev server and build tool with HMR
- **React 19**: UI library with React Compiler enabled
- **TypeScript**: Strict type checking throughout

### Routing & Data

- **TanStack Router**: File-based routing with hash history for Electron
- **TanStack Query**: Data fetching, caching, and synchronization
- **TanStack Form**: Performant, type-safe form state management
- **Zustand**: Small, fast and scalable bearbones state-management solution
- **Mutative**: Efficient immutable updates, faster than Immer (used as Zustand middleware)
- **ArkType**: The most optimized validation library for TypeScript
- **TanStack Virtual**: Virtualized lists for rendering large datasets efficiently
- **TanStack Unified Devtools**: Single devtools panel for Router, Query, and Form debugging
- **TanStack Router Plugin**: Vite plugin for TanStack Router code generation

### IPC & Backend

- **tRPC**: End-to-end type-safe APIs
- **electron-trpc-experimental**: tRPC over Electron IPC (no HTTP server needed)

### Styling

- **TailwindCSS v4**: Utility-first CSS framework
- **@tailwindcss/forms**: Form element styling plugin
- **tailwind-clamp**: Fluid typography and spacing utilities
- **react-icons**: Popular icon library with tree-shaking support

### Tooling

- **ESLint**: Linting with strict TypeScript rules
- **Prettier**: Code formatting with Tailwind plugin
- **vite-tsconfig-paths**: Auto-resolves TypeScript path aliases in Vite
- **Vitest**: Vite-native test runner, fast and Jest-compatible
- **electron-builder**: Cross-platform packaging and distribution
- **electron-updater**: Auto-update support (optional)
- **dotenv**: Environment variable loading

---

## Project Structure

```
├── electron/
│   ├── main.ts              # Main process entry
│   ├── preload.ts           # Preload script (tRPC bridge)
│   ├── security.ts          # URL allowlist helpers
│   ├── updater.ts           # Auto-update logic
│   ├── __tests__/           # Electron unit tests (Vitest)
│   └── backend/
│       └── trpc/
│           ├── init.ts      # tRPC initialization
│           ├── context.ts   # Request context
│           ├── router.ts    # Root router
│           └── routers/     # Domain routers
├── src/
│   ├── main.tsx             # Renderer entry
│   ├── router.ts            # TanStack Router config
│   ├── routeTree.gen.ts     # Auto-generated route tree
│   ├── routes/              # Route definitions
│   ├── pages/               # Page components
│   ├── components/          # Shared components
│   ├── assets/              # Static assets (icons, images)
│   ├── lib/
│   │   └── providers/       # React Query + tRPC providers
│   ├── trpc/
│   │   └── client.ts        # tRPC client setup
│   └── styles/
│       └── index.css        # Tailwind entry
├── electron-builder.json5   # Packaging config (all platforms)
├── vite.config.ts           # Vite config
├── vitest.config.ts         # Vitest config
├── tsconfig.json            # Base TypeScript config
├── tsconfig.renderer.json   # TypeScript config for renderer (src/)
├── tsconfig.node.json       # TypeScript config for main process (electron/)
└── tsconfig.eslint.json     # TypeScript config for ESLint
```

### Import Aliases

- `@/web/*` → `src/*`
- `@/app/*` → `electron/*`

Import aliases are defined in `tsconfig.json` and automatically resolved in Vite using the `vite-tsconfig-paths` plugin. This ensures consistency between TypeScript and the build tool without manual duplication.

---

## TypeScript Configuration

The project uses separate tsconfig files for different environments:

| Config                   | Purpose                                 | Includes                                               |
| ------------------------ | --------------------------------------- | ------------------------------------------------------ |
| `tsconfig.json`          | Base config for IDE and shared settings | All files (strict mode, path aliases)                  |
| `tsconfig.renderer.json` | Frontend React code                     | `src/` only (DOM types, Vite client)                   |
| `tsconfig.node.json`     | Electron main process and scripts       | `electron/`, `scripts/`, `vite.config.ts` (Node types) |
| `tsconfig.eslint.json`   | ESLint type-aware linting               | All TypeScript files                                   |

**Why separate configs?**

- **Renderer** runs in Chromium (browser context) with DOM APIs
- **Main process** runs in Node.js with filesystem and system APIs
- Separating them prevents accidental cross-environment imports and provides accurate type checking

### Adding a New tsconfig (Example: Convex)

When adding a tool like [Convex](https://convex.dev/) that has its own directory and tsconfig requirements:

**1. Create a dedicated tsconfig:**

```json
// tsconfig.convex.json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "lib": ["ESNext", "DOM"],
        "types": ["node"],
        "allowJs": true,
        "strict": true
    },
    "include": ["convex/**/*"],
    "exclude": ["node_modules"]
}
```

**2. Update `tsconfig.eslint.json` to include the new directory:**

```json
{
    "extends": "./tsconfig.json",
    "include": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "electron/**/*.ts",
        "convex/**/*.ts",
        "vite.config.ts",
        "eslint.config.js"
    ]
}
```

**3. Install the ESLint plugin:**

```bash
pnpm add -D @convex-dev/eslint-plugin
```

**4. Add ESLint config for Convex in `eslint.config.js`:**

```js
import convexPlugin from '@convex-dev/eslint-plugin';

export default [
    // ... existing config ...

    // Option A: Use recommended config (applies to convex/ by default)
    ...convexPlugin.configs.recommended,

    // Option B: Custom directory (if not using convex/)
    {
        files: ['**/my-convex-dir/**/*.ts'],
        plugins: {
            '@convex-dev': convexPlugin,
        },
        rules: convexPlugin.configs.recommended[0].rules,
    },
];
```

The Convex ESLint plugin enforces best practices:

- **no-old-registered-function-syntax**: Prefer object syntax for queries/mutations/actions
- **require-argument-validators**: Require `args` validators for type safety
- **import-wrong-runtime**: Prevent importing Node files into Convex runtime files

See the [official Convex ESLint docs](https://docs.convex.dev/eslint) for more details.

This pattern applies to any tool with its own directory (e.g., `drizzle/`, `prisma/`, etc.).

---

## Adding a tRPC Procedure

1. **Create a router** in `electron/backend/trpc/routers/`:

```ts
// electron/backend/trpc/routers/example.ts
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const exampleRouter = router({
    hello: publicProcedure.query(() => {
        return { message: 'Hello from the main process!' };
    }),
});
```

2. **Mount it** in `electron/backend/trpc/router.ts`:

```ts
import { exampleRouter } from '@/app/backend/trpc/routers/example';

export const appRouter = router({
    system: systemRouter,
    example: exampleRouter,
});
```

3. **Call it** from the renderer:

```tsx
import { trpc } from '@/web/trpc/client';

function MyComponent() {
    const { data } = trpc.example.hello.useQuery();
    return <p>{data?.message}</p>;
}
```

---

## Cross-Platform Builds

The template supports building for Windows, macOS, and Linux from a single codebase.

### Build Commands

| Command            | Output                 |
| ------------------ | ---------------------- |
| `pnpm build:win`   | Windows NSIS installer |
| `pnpm build:mac`   | macOS DMG              |
| `pnpm build:linux` | Linux AppImage         |

### App Icon

The template uses a **single PNG icon** (`src/assets/appicon.png`) that electron-builder automatically converts to platform-specific formats:

- **Windows**: `.ico`
- **macOS**: `.icns`
- **Linux**: `.png`

**Recommended icon size:** 512×512 or 1024×1024 pixels.

> The default app icon included in this template is AI-generated.

### Build Output

Built installers are placed in `release/{version}/`.

electron-builder normalizes the semver version and drops the `+metadata` portion when choosing the output directory name.

```
release/
└── 0.0.0-alpha.1/
    ├── Electron Template-Windows-0.0.0-alpha.1-Setup.exe
    ├── Electron Template-Mac-0.0.0-alpha.1-Installer.dmg
    └── Electron Template-Linux-0.0.0-alpha.1.AppImage
```

---

## Auto-Update

The template includes an auto-updater setup in `electron/updater.ts` that:

- **Checks for updates** automatically on app startup
- **Downloads updates** silently in the background
- **Shows native progress** in the taskbar/dock (Windows/macOS)
- **Prompts the user** to restart now or install when they quit

The updater is **disabled in dev/unpackaged builds** by default. To force-enable it for local testing, set:

```bash
UPDATER_ENABLED=1 pnpm dev
```

### Setup

To enable auto-updates, configure a publish provider in `electron-builder.json5` and set the required environment variables. See the [electron-builder publish docs](https://www.electron.build/configuration/publish) for the full reference.

### Publish Providers

#### GitHub Releases

The most common choice for open-source projects. Releases are hosted on GitHub and downloaded directly from there.

```json5
publish: [{ provider: 'github', owner: 'your-org', repo: 'your-repo' }],
```

**Environment variables:**

- `GH_TOKEN` or `GITHUB_TOKEN`: Personal access token with `repo` scope (required for publishing; optional for public repos during update checks)

For private repositories, the token is also required for the app to check for updates.

#### S3 / S3-Compatible Storage

Use AWS S3 or any S3-compatible service (DigitalOcean Spaces, MinIO, Backblaze B2, etc.).

**AWS S3:**

```json5
publish: [{
    provider: 's3',
    bucket: 'your-bucket-name',
    region: 'us-east-1',
}],
```

**DigitalOcean Spaces:**

```json5
publish: [{
    provider: 's3',
    bucket: 'your-space-name',
    region: 'nyc3',
    endpoint: 'https://nyc3.digitaloceanspaces.com',
}],
```

**Environment variables:**

- `AWS_ACCESS_KEY_ID`: Access key ID
- `AWS_SECRET_ACCESS_KEY`: Secret access key

#### Generic (Self-Hosted)

Host update files on any static file server (Nginx, Apache, Cloudflare R2, etc.). The server must serve the `latest.yml` / `latest-mac.yml` / `latest-linux.yml` files alongside your installers.

```json5
publish: [{ provider: 'generic', url: 'https://updates.example.com/your-app' }],
```

No environment variables required for electron-builder, authentication is handled by your server if needed.

##### Publishing to Generic Server via SSH

The template includes a `publish:generic` script (`scripts/publish.ts`) that uploads your built app to a self-hosted update server running in a Docker container via SSH.

**How it works:**

1. SSHs into your server and creates a temporary directory
2. Uploads the update manifest (`alpha.yml`, `beta.yml`, or `latest.yml`) and installer (`.exe`)
3. Copies files into a running Docker container using `docker cp`
4. Removes old installers and cleans up

**Required environment variables** (in `.env`):

| Variable            | Description                            | Example                               |
| ------------------- | -------------------------------------- | ------------------------------------- |
| `UPDATER_SSH`       | SSH destination (user@host)            | `deploy@updates.example.com`          |
| `UPDATER_SSH_PORT`  | SSH port (optional, defaults to 22)    | `22`                                  |
| `UPDATER_SSH_KEY`   | Path to SSH private key file           | `~/.ssh/id_ed25519`                   |
| `UPDATER_SSH_OPTS`  | Extra SSH options                      | `-o StrictHostKeyChecking=accept-new` |
| `UPDATER_CONTAINER` | Docker container name on remote        | `nginx-updates`                       |
| `UPDATER_PATH`      | Path inside container for update files | `/usr/share/nginx/html/updates`       |

**Example `.env`:**

```env
UPDATER_SSH=deploy@updates.example.com
UPDATER_SSH_PORT=22
UPDATER_SSH_KEY=~/.ssh/id_ed25519
UPDATER_SSH_OPTS=-o StrictHostKeyChecking=accept-new
UPDATER_CONTAINER=nginx-updates
UPDATER_PATH=/usr/share/nginx/html/updates
```

**Usage:**

```bash
# Build first
pnpm build:win

# Then publish to your server
pnpm publish:generic
```

### Publishing

Build and publish your app with the `--publish` flag:

```bash
# Publish to configured provider (drafts a release on GitHub)
pnpm build:win -- --publish always
```

The updater uses native OS progress indicators. When an update is ready, users can choose to restart immediately or have it install when they quit.

### Release Channels

electron-updater supports release channels based on the prerelease tag in your version.
The common channels are alpha, beta, and stable, but you can create custom channels too.

**How channel names work:**

The channel name comes from the first part of the prerelease tag (before the `.`):

| Version           | Channel Name | Manifest File |
| ----------------- | ------------ | ------------- |
| `1.0.0-alpha.1`   | alpha        | `alpha.yml`   |
| `1.0.0-beta.1`    | beta         | `beta.yml`    |
| `1.0.0-dev.1`     | dev          | `dev.yml`     |
| `1.0.0-canary.1`  | canary       | `canary.yml`  |
| `1.0.0-nightly.1` | nightly      | `nightly.yml` |
| `1.0.0`           | latest       | `latest.yml`  |

You can use any channel name you want, just use it consistently in your version tags.

There are two ways to determine which channel your app uses:

#### Option 1: Automatic Channel Detection (No Code Required)

If you do NOT set `autoUpdater.channel` in your code, electron-updater looks at the **installed app's version** to decide which update manifest to fetch:

| Installed Version | Manifest Fetched | Channel |
| ----------------- | ---------------- | ------- |
| `1.0.0-alpha.1`   | `alpha.yml`      | alpha   |
| `1.0.0-beta.1`    | `beta.yml`       | beta    |
| `1.0.0`           | `latest.yml`     | stable  |

**Why alpha users receive beta/stable updates:**

This is because of semver (semantic versioning) comparison, not channel logic.
When electron-updater compares versions:

- `1.0.0-beta.1` is considered "newer" than `1.0.0-alpha.1`
- `1.0.0` (stable) is considered "newer" than both `1.0.0-alpha.1` and `1.0.0-beta.1`

So if an alpha user's app fetches `alpha.yml` and finds `1.0.0-beta.1` listed there (because you published it), semver says "that's newer, update!"
The same applies when stable `1.0.0` is published.

**Important:** This only works if you publish your beta/stable releases to ALL manifests, or if users' apps can see the newer versions in their channel's manifest.

#### Option 2: Explicit Channel Declaration (Recommended)

You can override automatic detection by setting `autoUpdater.channel` in your code:

```ts
// electron/updater.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.channel = 'alpha'; // or 'beta' or 'latest' (stable)
```

**What this does:**

- The app will ALWAYS fetch the manifest you specify (`alpha.yml`, `beta.yml`, or `latest.yml`)
- The installed version no longer matters for channel detection
- Users will ONLY see updates published to that specific manifest
- The app will **never** look at other manifests, even if they contain newer versions

**Example:** If you set `autoUpdater.channel = 'alpha'`:

- User has `0.0.0-alpha.1` installed
- You publish `0.0.0-alpha.2` to `alpha.yml`, user updates normally
- You accidentally publish `0.0.0-beta.3` to `beta.yml` (a newer version)
- The user will **never** see `0.0.0-beta.3` because their app only fetches `alpha.yml`, not `beta.yml`
- The explicit channel acts like blinders, the app only sees the one manifest you told it to look at

**Why use explicit declaration:**

- **Required for GitHub provider**, GitHub releases don't respect the version tag for channel detection
- **Works with all providers**, no downside for generic/S3 providers
- **More predictable**, you control exactly which manifest the app checks
- **Enables manual migration**, you can change the channel in code to move users between channels
- **Users stay where you put them**, they won't accidentally jump to another channel

**The tradeoff:**

With explicit declaration, users will NOT automatically migrate to other channels.
If you set `autoUpdater.channel = 'alpha'`, users will stay on alpha forever unless:

1. You release an update that changes the channel in code (Strategy B below), or
2. Users reinstall the app with a different version

### Channel Migration Strategies

#### Strategy A: Automatic Migration (Version-Based)

**Requirements:** Do NOT set `autoUpdater.channel` in your code.

This approach relies on semver comparison to automatically move users to newer channels.

**How it works:**

1. You release `0.1.0-alpha.1`, `0.1.0-alpha.2`, etc. to `alpha.yml`
2. You release `0.1.0-beta.1` to `beta.yml` (and optionally to `alpha.yml` too)
3. You release `1.0.0` to `latest.yml` (and optionally to `alpha.yml` and `beta.yml` too)

**What users see:**

If you publish each release to ALL channel manifests:

- Alpha users see `0.1.0-beta.1` in `alpha.yml`, semver says it's newer, they update
- Beta users see `1.0.0` in `beta.yml`, semver says it's newer, they update
- Everyone converges on stable

If you only publish to the "current" channel manifest:

- Alpha users only see alpha releases until you publish a beta/stable to `alpha.yml`
- You have more control but must remember to update all manifests

**Version progression example:**

```
0.1.0-alpha.1  →  0.1.0-alpha.2  →  0.1.0-beta.1  →  1.0.0  →  1.0.1
    (alpha)          (alpha)          (beta)        (stable)   (stable)
```

After `1.0.0`, all users receive stable updates.

**Pros:** Simple, no code changes needed for migration.
**Cons:** Less control, depends on which manifests you publish to.

#### Strategy B: Manual Migration (Code-Based)

**Requirements:** You MUST set `autoUpdater.channel` in your code.

This approach gives you full control by changing the channel in your app's code.

**How it works:**

1. Your app has `autoUpdater.channel = 'alpha'` hardcoded
2. When ready to migrate alpha users to beta, you release an alpha update that changes the code to `autoUpdater.channel = 'beta'`
3. Users receive this update, and their app now checks `beta.yml` for future updates

**Step-by-step migration example (alpha → beta → stable):**

**Step 1:** Initial alpha releases with channel set to `'alpha'`:

```ts
// electron/updater.ts (versions 0.1.0-alpha.1 through 0.1.0-alpha.5)
autoUpdater.channel = 'alpha';
```

**Step 2:** Final alpha release that migrates users to beta:

```ts
// electron/updater.ts (version 0.1.0-alpha.6, the "migration" release)
autoUpdater.channel = 'beta'; // Changed from 'alpha' to 'beta'
```

Publish `0.1.0-alpha.6` to `alpha.yml` only.
Alpha users receive this update.
After updating, their app now fetches `beta.yml` instead of `alpha.yml`.

**Step 3:** Continue with beta releases:

```ts
// electron/updater.ts (versions 0.1.0-beta.1 onwards)
autoUpdater.channel = 'beta';
```

**Step 4:** Final beta release that migrates users to stable:

```ts
// electron/updater.ts (version 0.1.0-beta.5, the "migration" release)
autoUpdater.channel = 'latest'; // Changed from 'beta' to 'latest' (stable)
```

Publish `0.1.0-beta.5` to `beta.yml` only.
Beta users receive this update.
After updating, their app now fetches `latest.yml` instead of `beta.yml`.

**Step 5:** Continue with stable releases:

```ts
// electron/updater.ts (versions 1.0.0 onwards)
autoUpdater.channel = 'latest';
```

**Key points:**

- The migration release must be published to the **current** channel's manifest (so existing users receive it)
- After updating, users will fetch the **new** channel's manifest
- You may need `allowDowngrade = true` if the new channel has a "lower" semver version than what users have installed

**Pros:** Full control over when users migrate.
**Cons:** Requires code changes and careful release coordination.

#### Strategy C: Long-Lived Parallel Channels

Use this when you want to keep alpha/beta/stable as separate, permanent tracks.
Users stay on their chosen channel indefinitely.

**Requirements:** You can use either automatic or explicit channel detection, but explicit is recommended for clarity.

**How it works:**

1. Maintain separate version lines: `2.0.0-alpha.x`, `1.1.0-beta.x`, `1.0.x`
2. Publish each version only to its own channel's manifest
3. Users never automatically migrate between channels

**When to use:**

- You want dedicated testers on bleeding-edge builds permanently
- You need to maintain multiple release tracks simultaneously
- Enterprise users need stable while power users want beta features

**Build configuration:**

Add `generateUpdatesFilesForAllChannels` to generate all manifests from a single build:

```json5
// electron-builder.json5
{
    // ... other config ...
    generateUpdatesFilesForAllChannels: true,
}
```

This creates `alpha.yml`, `beta.yml`, and `latest.yml` from a single build.
You then choose which manifest(s) to upload to your update server.

### In-App Channel Switching (Optional)

You can allow users to switch update channels from within the app by setting `autoUpdater.channel`.

**Basic implementation:**

```ts
// electron/updater.ts
import { autoUpdater } from 'electron-updater';

// Set channel based on user preference (e.g., from electron-store or config)
export function setUpdateChannel(channel: 'alpha' | 'beta' | 'stable'): void {
    // Setting channel automatically enables allowDowngrade
    autoUpdater.channel = channel === 'stable' ? 'latest' : channel;

    // Check for updates on the new channel
    void autoUpdater.checkForUpdates();
}
```

**Important considerations:**

- **`allowDowngrade` is auto-enabled** when you set `channel`, allowing users to move from beta to stable
- **Channel names**: Use `'latest'` for stable, `'beta'` for beta, `'alpha'` for alpha
- **Persistence**: Store the user's channel preference (e.g., with `electron-store`) and apply it on app startup
- **UI/UX**: Warn users that switching to alpha/beta may introduce instability
- **Rollback risk**: Moving from stable to alpha could cause issues if data formats changed

**Exposing to renderer via tRPC:**

```ts
// electron/backend/trpc/routers/settings/updateChannel.ts
import { publicProcedure } from '@/app/backend/trpc/init';
import { autoUpdater } from 'electron-updater';
import { z } from 'zod'; // or your preferred validator

export const setUpdateChannel = publicProcedure.input(z.enum(['alpha', 'beta', 'stable'])).mutation(({ input }) => {
    autoUpdater.channel = input === 'stable' ? 'latest' : input;
    void autoUpdater.checkForUpdates();
    return { channel: input };
});
```

### Edge Cases & Caveats

**How semver comparison works:**

electron-updater uses semver to decide if an update is "newer" than the installed version:

- `1.0.0` is greater than `1.0.0-beta.1` (stable is always "newer" than prerelease of same version)
- `1.0.0` is greater than `1.0.0-alpha.1` (same reason)
- `1.0.1-alpha.1` is greater than `1.0.0` (higher version number wins, even if prerelease)
- `1.0.0-beta.1` is greater than `1.0.0-alpha.1` (beta > alpha in prerelease ordering)

This is why alpha users "automatically" get beta/stable updates in Strategy A: semver says those versions are newer.

**Downgrade scenarios:**

- By default, downgrades are blocked (`allowDowngrade: false`)
- Setting `autoUpdater.channel` automatically enables `allowDowngrade`
- Be cautious: downgrading may cause issues if newer versions changed data formats or database schemas

**GitHub provider specifics:**

- GitHub releases do NOT automatically detect channels from version tags
- You MUST set `autoUpdater.channel` explicitly when using GitHub provider
- The `allowPrerelease` option only affects GitHub provider

**Manifest file naming:**

| Channel | Manifest File |
| ------- | ------------- |
| stable  | `latest.yml`  |
| beta    | `beta.yml`    |
| alpha   | `alpha.yml`   |

For macOS and Linux, the filenames are `latest-mac.yml`, `beta-mac.yml`, `alpha-mac.yml`, etc.

### Troubleshooting

**Build generates `latest.yml` instead of `alpha.yml` (or other channel):**

If your `package.json` has a prerelease version like `1.0.0-alpha.1` but your build only generates `latest.yml`, this usually means:

1. **Missing `publish` configuration**, electron-builder requires a `publish` provider to be configured in `electron-builder.json5` to properly generate channel-specific manifests
2. **Wrong build target**, some build targets don't generate yml files

To fix, ensure you have a `publish` configuration:

```json5
// electron-builder.json5
{
    // ... other config ...
    publish: [{ provider: 'generic', url: 'https://your-update-server.com' }],
}
```

**Want all channel manifests from a single build:**

Add `generateUpdatesFilesForAllChannels` to your config:

```json5
// electron-builder.json5
{
    // ... other config ...
    generateUpdatesFilesForAllChannels: true,
}
```

This generates `alpha.yml`, `beta.yml`, and `latest.yml` regardless of your current version.

**Auto-update not working at all:**

Check that `app-update.yml` exists in your packaged app's `resources` folder.
This file is generated from your `publish` configuration and tells electron-updater where to check for updates.

---

## Caveats & Notes

### Rolldown (Experimental Vite Bundler)

This template has been tested with Vite's experimental **Rolldown** bundler mode. However, it caused issues in at least one environment and is **not enabled by default**. If you want to try Rolldown:

1. Update your `vite.config.ts` to enable the experimental bundler
2. Test thoroughly before deploying to production

The template currently uses Vite's stable default bundler for maximum compatibility.

### Window Initialization (No White Flash)

The template implements a seamless window launch sequence to prevent the common "white flash" issue:

1. **Window starts hidden**: `show: false` in BrowserWindow options
2. **Native background color**: `backgroundColor` matches the app theme, painted immediately at OS level
3. **React-ready signal**: The renderer calls a tRPC mutation when React has actually rendered
4. **Maximize and show**: Window is maximized and revealed only after content is ready
5. **Fallback show**: If the renderer never signals ready, the window is shown after a short timeout

This is coordinated across three files:

- `electron/main.ts`: Creates hidden window, waits for tRPC signal
- `electron/backend/trpc/routers/system/signalReady.ts`: Mutation handler that maximizes and shows the window
- `src/main.tsx`: Calls `trpcClient.system.signalReady.mutate()` after `createRoot().render()` completes

### Security

The template follows Electron security best practices:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Minimal preload surface via `exposeElectronTRPC()` + ready signal
- No application menu bar (File, Edit, View, Help removed)
- DevTools enabled only in development mode (opens detached), disabled in production builds
- Content Security Policy (CSP) enforced via HTTP headers
- External navigation allowlist (`http:`, `https:`, `mailto:` only)

External links opened from the renderer are routed to the OS browser. Non-allowlisted schemes are blocked and logged.

#### Content Security Policy (CSP)

CSP is managed centrally in `electron/csp.ts` and enforced via HTTP headers injected in `electron/main.ts`. The header is the single source of truth.

**Where CSP is defined:**

- `electron/csp.ts`: Central CSP configuration module (source of truth)
- `electron/main.ts`: Injects CSP headers via `session.webRequest.onHeadersReceived`

**Default policy:**

| Directive         | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `default-src`     | `'self'`                                                                |
| `script-src`      | `'self'`                                                                |
| `style-src`       | `'self' 'unsafe-inline' https://fonts.googleapis.com`                   |
| `img-src`         | `'self' data:`                                                          |
| `font-src`        | `'self' https://fonts.gstatic.com`                                      |
| `connect-src`     | `'self'` (+ dev server origin + `ws://localhost:*` in dev for Vite HMR) |
| `object-src`      | `'none'`                                                                |
| `frame-src`       | `'self'`                                                                |
| `frame-ancestors` | `'none'`                                                                |
| `base-uri`        | `'self'`                                                                |
| `form-action`     | `'self'`                                                                |
| `worker-src`      | `'self'`                                                                |

**Common modifications:**

To allow an external API (e.g., `https://api.example.com`), add it to `connect-src` in `electron/csp.ts`:

```ts
// In basePolicy
'connect-src': ["'self'", 'https://api.example.com'],
```

To allow images from a CDN:

```ts
'img-src': ["'self'", 'data:', 'https://cdn.example.com'],
```

**Dev vs Prod:**

- **Dev:** Allows the dev server origin (derived from `VITE_DEV_SERVER_URL`) + `ws://` for HMR, and `'unsafe-inline'` scripts for hot reload
- **Prod:** Strict policy with no dev-specific loosening

**Debugging CSP issues:**

CSP violations appear in DevTools console as `Refused to load...` errors.
Check which directive is blocking the resource and add the appropriate origin to `electron/csp.ts`.

**Using Convex with CSP:**

If you add [Convex](https://convex.dev/) as a backend, update `electron/csp.ts` to allow Convex's domains:

```ts
// In basePolicy, add your Convex deployment URL to connect-src
'connect-src': [
    "'self'",
    'https://<your-project>.convex.cloud',  // Convex HTTP API
    'wss://<your-project>.convex.cloud',    // Convex WebSocket (real-time sync)
],
```

Replace `<your-project>` with your actual Convex deployment name (found in your Convex dashboard).
The WebSocket (`wss://`) entry is required for Convex's real-time reactivity.

---

## Included Libraries

### State Management: Zustand with Mutative

This template includes [Zustand](https://zustand.docs.pmnd.rs/) for state management with [Mutative](https://mutative.js.org/) as the middleware for immutable updates (faster than Immer).

**Example usage with Mutative middleware:**

```ts
import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

interface CounterStore {
    count: number;
    increment: () => void;
    decrement: () => void;
    addAmount: (amount: number) => void;
}

export const useCounterStore = create<CounterStore>()(
    mutative((set) => ({
        count: 0,
        increment: () =>
            set((state) => {
                state.count += 1; // Direct mutation - Mutative handles immutability
            }),
        decrement: () =>
            set((state) => {
                state.count -= 1;
            }),
        addAmount: (amount) =>
            set((state) => {
                state.count += amount;
            }),
    }))
);
```

**Why Mutative over Immer?**

- ~10x faster than Immer in benchmarks
- Smaller bundle size
- Same familiar API (write "mutations" that become immutable updates)

### Validation: ArkType

This template includes [ArkType](https://arktype.io/) as the validation library. ArkType provides TypeScript-first schema validation with excellent type inference.

**Example usage:**

```ts
import { type } from 'arktype';

const User = type({
    name: 'string',
    email: 'string.email',
    age: 'number >= 0',
});

// Type is automatically inferred
type User = typeof User.infer;

// Validate data
const result = User({ name: 'John', email: 'john@example.com', age: 25 });
if (result instanceof type.errors) {
    console.error(result.summary);
} else {
    console.log(result); // Typed as User
}
```

---

## Recommended Additions

Depending on your project needs, consider adding:

### UI Components

- **[Radix UI](https://radix-ui.com/)** or **[Base UI](https://base-ui.com/)**: Unstyled, accessible component primitives
- **[shadcn/ui](https://ui.shadcn.com/)**: Re-usable components built on Radix UI and Tailwind CSS

### Backend / Database

- **[Convex](https://convex.dev/)**: Reactive backend platform with real-time sync and end-to-end type safety
- **[Drizzle ORM](https://orm.drizzle.team/)**: TypeScript-first ORM for SQLite, PostgreSQL, and MySQL

---

## License

MIT
