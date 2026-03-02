# Runtime P1A: Persistence + Snapshot/Event Foundation

This document tracks the P1A implementation in `Project/electron/backend`.

## What Was Added

1. SQLite persistence bootstrap with `better-sqlite3 + Kysely`.
2. SQL migrations and idempotent migration runner.
3. Store layer for runtime domains:
   - sessions/runs
   - providers/models/defaults
   - permissions
   - tools catalog
   - MCP servers
   - runtime event log
4. Runtime snapshot and runtime event services.
5. New tRPC domain:
   - `runtime.getSnapshot`
   - `runtime.getEvents`
6. Secret storage abstraction:
   - `SecretStore`
   - `InMemorySecretStore` placeholder

## Behavior Notes

1. Session/provider/permission/mcp mutation routes now append `runtime_events`.
2. Seed data is applied idempotently on initialization.
3. `system` and `updates` routers are unchanged.
4. Runtime contracts and existing route names remain stable.

## Deferred To Next Step

1. OS-native secret storage integration (Credential Manager/Keychain/Secret Service).
2. Kilo/OpenAI auth and provider transport execution.
3. Live event subscription transport and renderer wiring.
4. Full Kilo parity schema expansion.

