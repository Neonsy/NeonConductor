## Summary

<!-- What changed, and why? Keep it concrete. -->

## Related Issues

<!-- Examples: Closes #123, Related #456 -->

## PR Type

- [ ] `feat`
- [ ] `fix`
- [ ] `chore`
- [ ] `docs`
- [ ] `refactor`
- [ ] `test`
- [ ] `perf`
- [ ] `build`
- [ ] `ci`

## Branch Flow Check

- [ ] This PR follows the branch flow rules (`dev -> prev`, `prev -> main`).
- [ ] For normal work, base branch is `dev`.
- [ ] If targeting `prev` or `main`, this is a promotion/release PR requested by a maintainer.

## Changeset Check

- [ ] This PR touches non-doc files in `Project/**` and includes the required changeset in `Project/.changeset/` (applies to `dev`, `prev`, and `main`).
- [ ] No changeset is required because this PR is docs-only in `Project/**` (markdown/docs paths) or does not change `Project/**`.

## Validation

- [ ] `pnpm -C Project lint`
- [ ] `pnpm -C Project typecheck`
- [ ] `pnpm -C Project test`
- [ ] I did not run one or more checks above, and explained why below.

## Scope Labels (for maintainers)

<!-- Pick the closest label(s): -->
<!-- scope: agent-core | scope: orchestration | scope: tools | scope: memory -->
<!-- scope: ui | scope: api | scope: integrations | scope: infra -->
<!-- scope: docs | scope: tests | scope: dependencies -->

## Risk / Impact

<!-- User impact, migration notes, breaking changes, rollback notes. -->

## Screenshots / Recordings (UI changes)

<!-- Add before/after screenshots or short recordings when applicable. -->

## Additional Notes

<!-- Anything reviewers should know. -->
