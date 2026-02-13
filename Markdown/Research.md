# NeonConductor Research: Kilo + OpenCode + TanStack Start

This document is standalone and decision-focused.
It explains what to build custom, what to borrow as patterns, and what must stay compatible with Kilo account and cloud behavior.

---

## 1. Ground Truth

1. The relevant OpenCode upstream is `anomalyco/opencode`.
2. Kilo is built from OpenCode lineage and keeps similar runtime concepts.
3. NeonConductor does not need to adopt OpenCode wholesale.
4. Kilo/cloud policy behavior still matters if you want Kilo account compatibility.

---

## 2. What OpenCode Gives You (Reference Patterns)

From the OpenCode codebase:

1. Full local runtime API structure:
   - sessions, providers, MCP, permissions, project/config/file/PTY, events/TUI
   - reference area: `packages/opencode/src/server`
2. Session orchestration loop:
   - multi-step turns, tool calls, cancel/resume, compaction, structured output
   - reference area: `packages/opencode/src/session/prompt.ts`
3. Tool registry architecture:
   - built-in tools + plugin tools + model-aware tool gating
   - reference area: `packages/opencode/src/tool/registry.ts`
4. MCP lifecycle model:
   - local stdio + remote HTTP/SSE + OAuth/auth + dynamic MCP tools/resources
   - reference area: `packages/opencode/src/mcp/index.ts`

These are strong architecture references, not mandatory implementation dependencies.

---

## 3. Provider Strategy (Including OpenAI-Compatible)

OpenCode uses AI SDK provider adapters plus compatibility layers.
Practical strategy for NeonConductor:

1. Use native provider adapters when available (Bedrock, Azure, Anthropic, OpenAI, OpenRouter, etc).
2. Use OpenAI-compatible transport for providers exposing OpenAI-style APIs (custom `baseURL` + API key).
3. Keep provider config schema extensible for custom providers/models.

Reference areas:

- `packages/opencode/src/provider/provider.ts`
- `packages/opencode/src/config/config.ts`

---

## 4. Dynamic Models and Auto-Selection

OpenCode supports dynamic model catalogs, but default model selection is still heuristic.

What this means:

1. Dynamic catalog refresh is solvable and already proven.
2. OpenRouter-profile-style live routing (`lowest_cost`, `lowest_latency`, `highest_tps`) is not the default behavior.
3. If you want that behavior, build a custom ranking policy layer.

Recommended ranking inputs:

1. Static metadata (context window, modality, cost).
2. Runtime telemetry (latency, error rate, effective throughput).
3. User strategy preference (`balanced`, `cheapest`, `fastest`, `highest_tps`).

### Current Kilo VS Code behavior (important baseline)

1. The extension fetches provider/model catalog from CLI backend `GET /provider`, then displays it in the webview model selector.
2. Initial model selection is extension-setting driven, using:
   - `kilo-code.new.model.providerID` (default `kilo`)
   - `kilo-code.new.model.modelID` (default `kilo/auto`)
3. The model selector UI supports search/filter and fixed provider grouping order, but does not do live cost/latency/TPS ranking.
4. Message send path passes selected `{ providerID, modelID }` to backend when present.
5. If no explicit selection is sent, backend falls back to prior session model and then provider default heuristics.
6. Kilo models are dynamically fetched from Kilo Gateway/OpenRouter-compatible endpoints and cached, so model inventory is dynamic even though ranking is not.
7. Kilo default-model API exists server-side, but extension chat-default behavior is still primarily controlled by extension defaults above.

Reference areas:

- `packages/kilo-vscode/src/KiloProvider.ts`
- `packages/kilo-vscode/webview-ui/src/context/provider.tsx`
- `packages/kilo-vscode/webview-ui/src/context/session.tsx`
- `packages/kilo-vscode/webview-ui/src/components/chat/ModelSelector.tsx`
- `packages/opencode/src/provider/models.ts`
- `packages/opencode/src/provider/model-cache.ts`
- `packages/opencode/src/provider/provider.ts`
- `packages/opencode/src/server/routes/provider.ts`
- `packages/opencode/src/server/routes/config.ts`
- `packages/kilo-gateway/src/api/models.ts`
- `packages/kilo-gateway/src/api/profile.ts`

---

## 5. Kilo Account Compatibility Rules

If Kilo account mode is a core feature:

1. Treat Kilo gateway/cloud as source of truth for auth, entitlement, model access, and usage policy.
2. Treat direct third-party provider keys as optional advanced mode.
3. Keep provider/model resolution aligned with Kilo policy endpoints, not only local config.

---

## 6. TanStack Start Role

TanStack Start should be the app framework layer, not the agent runtime.

Recommended split:

1. TanStack Start:
   - routes, server functions, middleware, typed app/server boundaries
2. Electron main:
   - orchestrator loop, tool execution, MCP lifecycle, local session state/event bus
3. Kilo cloud/gateway:
   - account and policy authority

---

## 7. Build vs Borrow

Borrow first:

1. Session API semantics (`create`, `prompt`, `abort`, `status`, `revert`).
2. Tool registry shape and gating model.
3. MCP status/auth lifecycle model.
4. Event streaming contract and state transitions.

Build custom first:

1. Desktop UX and permission ergonomics.
2. Multi-session orchestration behavior.
3. Auto-routing/ranking policy.
4. Product-specific safety boundaries and guardrails.

---

## 8. Recommended Implementation Order

1. Define runtime contract in Electron main (`session.*`, `tool.*`, `mcp.*`, `provider.*`, `permission.*`).
2. Implement orchestrator v1 with cancel/resume and tool checkpoints.
3. Add provider abstraction (native adapters + OpenAI-compatible providers + Kilo account mode).
4. Add dynamic model catalog ingestion and caching.
5. Add custom ranking policy for cost/latency/TPS strategies.
6. Add compatibility tests for Kilo account and policy behavior.

---

## 9. Bottom Line

1. Use OpenCode as architecture inspiration, not as required foundation.
2. Build NeonConductor as TanStack Start + Electron-main custom runtime.
3. Keep Kilo account/gateway behavior authoritative when account mode is enabled.
4. Implement auto-routing as your own policy subsystem.
