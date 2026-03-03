# Runtime P2C - Runtime Transport, Durable Messages, and Usage Ledger Parity

This document tracks the P2C implementation in `Project/electron`.

## Completed Scope

1. Added migration `007_p2c_runtime_transport_and_usage.sql`.
2. Hardened runtime transport persistence:
    - `sessions.profile_id`
    - `runs.profile_id`
    - execution metadata on `runs` (`provider_id`, `model_id`, `auth_method`, `started_at`, `completed_at`, `aborted_at`, `error_code`, `error_message`)
    - durable `messages` and `message_parts`
    - `run_usage` ledger
3. Session contracts are now explicitly profile-scoped for runtime execution paths.
4. Breaking contract update:
    - removed `session.prompt`
    - added `session.startRun`
    - added `session.listRuns`
    - added `session.listMessages`
5. Added backend-owned run execution service:
    - validates session/provider/model/auth
    - persists user + assistant message records and parts
    - finalizes run/session status deterministically
    - supports cancellation via abort controller registry
6. Split provider runtime responsibilities into execution adapters:
    - `kilo` runtime execution path
    - `openai` runtime execution path (`/chat/completions` with `/responses` fallback)
7. Added runtime execution event projection:
    - `run.started`
    - `run.part.appended`
    - `run.completed`
    - `run.aborted`
    - `run.failed`
    - `run.usage.recorded`
8. Added usage normalization and provider summary aggregation.
9. Runtime snapshot extended with:
    - `runs`
    - `messages`
    - `messageParts`
    - `runUsage`
    - `providerUsageSummaries`
10. Removed status-side-effect runtime shortcut:
    - `session.status()` no longer auto-completes runs.

## Breaking Changes

1. `session.prompt` was removed and replaced by `session.startRun`.
2. Session runtime procedures now require explicit `profileId`.
3. Runtime snapshot now includes durable run/message/usage slices listed above.

## Deferred

1. No major new end-user runtime screen in this phase; renderer remains projection-first.
2. Cloud session execution remains deferred to roadmap `P11`.
