# Changesets

This folder stores release notes and version bump entries used by the release workflows.

Create a new file in this folder for release-impacting changes with this format:

```md
---
'neon-conductor': patch|minor|major|none
---

Short summary of the change for release notes.
```

Bump meanings:

- `patch`: backward-compatible fixes or small improvements
- `minor`: backward-compatible features
- `major`: breaking changes
- `none`: no version bump, but keep release-note context
