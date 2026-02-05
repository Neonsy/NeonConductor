# This document provides an overview for all who contribute to KiloDesktop.

## Branch Gate Strategy

KiloDesktop uses a three-tier branch gate system to ensure code quality and deployment stability:

### Development Flow

**Work-in-Progress Branches**

-   Any branch outside of the 3 main branches (`dev`, `preview`, `main`) represents work-in-progress, prototypes, and ideas
-   These branches have no special meaning and are for experimentation and feature development

**dev → preview → main**

1. **dev branch** - Current Development State

    - Collects work-in-progress features from feature branches
    - Reflects the current active development state
    - All feature branches should target `dev` for pull requests

2. **preview branch** - Staging Environment

    - Takes everything from `dev` branch that has passed initial checks
    - Generates preview deployments and publishes to the beta branch
    - Acts as a staging gate before production

3. **main branch** - Production Ready
    - Receives stable changes from `preview` branch
    - Should only contain thoroughly tested, stable code
    - Triggers production deployment when all checks pass on PR merge
    - Represents the stable/production state

### Deployment Pipeline

-   **dev** → CI checks only
-   **preview** → CI checks + preview deployment generation
-   **main** → CI checks + production deployment (on merge)

This ensures progressive stability validation as code moves through the development pipeline.

## Labels Guide

### Automation / CI Status

| Label Title | When to use it |
| --- | --- |
| `ci: failing` | CI failed on default checks |
| `ci: flaky` | Intermittent CI failures observed |
| `ci: blocked` | CI cannot run due to missing secrets or env |
| `ci: passing` | All required checks passing |
| `automation: dependabot` | Automated PR opened by Dependabot |

### Issue Types

| Label Title | When to use it |
| --- | --- |
| `type: bug` | Defect or regression |
| `type: feature` | New user-facing capability |
| `type: enhancement` | Improvement to existing behavior |
| `type: chore` | Maintenance or refactor |
| `type: docs` | Documentation-only change |
| `type: dependencies` | Dependency updates or lockfile changes |
| `type: refactor` | Code structure changes without behavior change |
| `type: performance` | Performance or cost improvements |
| `type: question` | Clarification or discussion |
| `type: security` | Security-related issue |

### PR Scope / Areas

| Label Title | When to use it |
| --- | --- |
| `scope: agent-core` | Agent lifecycle, state, prompts, policies |
| `scope: orchestration` | Planning, routing, scheduling, coordination |
| `scope: tools` | Tool registry, execution, adapters |
| `scope: memory` | Memory store, embeddings, retrieval |
| `scope: ui` | Desktop UI and interaction surfaces |
| `scope: api` | Internal or external APIs |
| `scope: integrations` | External services and providers |
| `scope: infra` | Build, CI, deployment, scripts |
| `scope: docs` | Docs specific to a PR’s area |
| `scope: tests` | Test-only changes |
| `scope: dependencies` | Package updates and lockfiles |

### Priority / Severity

| Label Title | When to use it |
| --- | --- |
| `priority: p0` | Must fix immediately |
| `priority: p1` | High priority, near-term |
| `priority: p2` | Normal priority |
| `priority: p3` | Low priority |
| `severity: s0` | System-wide or data-loss impact |
| `severity: s1` | Major user impact |
| `severity: s2` | Minor or localized impact |

### Status

| Label Title | When to use it |
| --- | --- |
| `status: needs-triage` | New, unreviewed |
| `status: needs-info` | Blocked on reporter details |
| `status: accepted` | Approved to work on |
| `status: in-progress` | Actively being worked |
| `status: blocked` | External dependency or hard block |
| `status: on-hold` | Paused pending decision or timing |
| `status: ready-for-review` | Implementation done; needs review |
| `status: done` | Completed and verified |
| `status: duplicate` | Duplicate of an existing issue |
| `status: wontfix` | Closed without planned changes |
