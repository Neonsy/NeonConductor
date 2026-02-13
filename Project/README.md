# NeonConductor: Error Handling and Logging Guide

This README is intentionally focused on two project standards:

1. `neverthrow` for predictable error flow in service/workflow code.
2. `evlog` for structured, local-first logging in the Electron main process.

## Why We Use These

### `neverthrow` (idea)

`neverthrow` makes expected operational failures explicit in types.

Instead of throwing from every layer, functions return `Result`/`ResultAsync` and callers must handle success or failure.

This helps when flows become multi-step (filesystem, updater, network, process calls) and prevents silent error paths.

### `evlog` (idea)

`evlog` gives structured logs (JSON objects), not ad-hoc strings.

In this app, each tRPC IPC request in the main process is logged as one "wide event" with metadata (request id, path, status, duration, sender/window info).

Logs are written locally to NDJSON files for easy debugging and future ingestion.

## `neverthrow` Usage

### Where to use it

Use in:
- service/domain modules
- multi-step workflows
- code that touches external boundaries (fs/network/process/updater)

Avoid forcing it in:
- trivial one-step handlers
- simple pass-through router/UI glue
- presentational renderer code

### Basic pattern

```ts
import { readFile } from 'node:fs/promises';
import { ResultAsync, err, ok } from 'neverthrow';

export function loadConfig(path: string) {
  return ResultAsync.fromPromise(
    readFile(path, 'utf8'),
    (cause) => new Error(`config-read-failed: ${String(cause)}`)
  )
    .andThen((raw) => {
      try {
        return ok(JSON.parse(raw));
      } catch {
        return err(new Error('config-parse-failed'));
      }
    });
}

// Boundary translation example (router/main boundary)
const result = await loadConfig('config.json');
return result.match(
  (value) => value,
  (error) => {
    throw error; // or translate to TRPCError here
  }
);
```

## `evlog` Usage in This Repo

### Current architecture

- Logger init: `Project/electron/main/logging/index.ts`
- File drain: `Project/electron/main/logging/fileDrain.ts`
- Bootstrap wiring: `Project/electron/main/bootstrap/index.ts`
- tRPC request middleware logging: `Project/electron/backend/trpc/init.ts`

Behavior:
- Logging is enabled by default in dev.
- In packaged/prod, logging is off unless explicitly enabled.
- Output path: `app.getPath('userData')/logs/YYYY-MM-DD.ndjson`

### Env toggles

- `EVLOG_ENABLED=1` force-enable logging
- `EVLOG_ENABLED=0` force-disable logging
- `EVLOG_PRETTY=1` pretty text output
- `EVLOG_PRETTY=0` strict JSON output

### Create custom logs (yes, supported)

You already export `appLog` from `Project/electron/main/logging/index.ts`.

Use it anywhere in Electron main-process code:

```ts
import { appLog } from '@/app/main/logging';

appLog.info('updates', 'check started');

appLog.warn({
  action: 'update-check',
  channel: 'beta',
  reason: 'manual-trigger',
});

appLog.error({
  action: 'update-install',
  code: 'E_INSTALL',
  retryable: true,
});
```

### Create custom request-wide events

When you want a single aggregated event for an operation:

```ts
import { createRequestLogger } from 'evlog';

const reqLog = createRequestLogger({
  method: 'TASK',
  path: 'updates.applyPatch',
  requestId: crypto.randomUUID(),
});

reqLog.set({ senderId, windowId, step: 'download' });
reqLog.set({ step: 'verify-signature' });

try {
  // ...workflow
  reqLog.emit({ status: 200 });
} catch (error) {
  reqLog.error(error instanceof Error ? error : String(error), { phase: 'apply' });
  reqLog.emit({ status: 500 });
}
```

This pattern matches what the tRPC middleware does today.

### Can setup support custom log pipelines?

Yes.

`Project/electron/main/logging/fileDrain.ts` already uses `createDrainPipeline(...)`.
You can customize:
- batch size / flush interval
- retry behavior
- max buffer size
- drop handling (`onDropped`)

You can also swap the drain target later (file -> cloud adapter) while keeping the same `initLogger({ drain })` pattern.

### Safety rules for logging

- Do not log raw tRPC request/response bodies by default.
- Prefer metadata: path, requestId, senderId, windowId, status, duration, error code.
- Never log secrets/tokens/keys.

### Practical reading tip for `.ndjson`

Each line is one JSON object.
If your editor shows one-line minified entries, use an NDJSON/JSON-lines viewer extension or pipe through a formatter tool that handles JSON Lines.
