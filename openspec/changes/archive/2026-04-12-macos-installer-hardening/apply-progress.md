# Apply Progress: macos-installer-hardening

## Status
Remediation pass complete for verify CRITICAL/WARNING findings in **Strict TDD** mode. New RED→GREEN cycles were executed for source-mode validation, README configure clarity, installer gap branches, and explicit missing-key guidance assertions.

## Remediation Scope (this pass)
- Fixed source-mode false warning: direct-binary MCP command now validates as pass for source installs.
- Fixed README Configure contradiction for npx users with mode-aware command guidance.
- Added runtime documentation test evidence for Install vs Configure clarity and doctor troubleshooting entry point.
- Extended installer contract coverage for missing `npm` and missing `session-vault-serve` PATH branches.
- Added explicit missing-key guidance assertions in both `init` and `doctor` command tests.
- Fixed diagnostics missing-key troubleshooting so DB-ID failures reference the correct env vars.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Source-mode doctor regression | `test/cli/install-mode.test.ts`, `test/cli/doctor.test.ts` | Unit | ✅ `npm test -- test/cli/install-mode.test.ts test/cli/doctor.test.ts test/cli/init.test.ts test/scripts/install.contract.test.ts` (16/16) | ✅ Added failing assertions for `validateMcpCommandShape('source', ['session-vault-serve'])` and doctor source-mode pass case | ✅ Updated `src/cli/install-mode.ts`; targeted suite green | ✅ Added command-shape + doctor-level coverage (helper + integration point) | ➖ None needed |
| README/configure npx correctness + docs scenario evidence | `test/docs/readme.test.ts` | Unit (docs contract) | N/A (new) | ✅ Added failing `npx session-vault init/doctor` assertions in Configure section | ✅ Updated `README.md`; docs test passes | ✅ Asserts section separation and mode-aware commands + doctor troubleshooting entry | ➖ None needed |
| Installer missing dependency/PATH gap branches | `test/scripts/install.contract.test.ts` | Integration (vitest + spawned bash) | ✅ Included in safety-net baseline (4/4 contract tests green) | ✅ Added failing branches for missing `npm` and missing `session-vault-serve` | ✅ Existing `scripts/install.sh` behavior already satisfied new branches; contract suite passes | ✅ Branch pair now covers node vs npm missing and session-vault vs session-vault-serve PATH failures | ➖ None needed |
| Explicit missing-key guidance assertions in init/doctor | `test/cli/init.test.ts`, `test/cli/doctor.test.ts`, `test/notion/diagnostics.test.ts` | Unit | ✅ Included in safety-net baseline (`init` + `doctor` were green before modifications) | ✅ Added failing explicit guidance assertions (`Set NOTION_API_KEY`, DB-ID guidance strings) | ✅ Updated `src/notion/diagnostics.ts` to target env-var specific troubleshooting | ✅ Covers api-key + sessions-db + ideas-db missing-key guidance across module and command rendering | ➖ None needed |

## RED/GREEN Command Log
- **Safety Net**: `npm test -- test/cli/install-mode.test.ts test/cli/doctor.test.ts test/cli/init.test.ts test/scripts/install.contract.test.ts` → ✅ 16/16
- **RED run**: `npm test -- test/cli/install-mode.test.ts test/cli/doctor.test.ts test/cli/init.test.ts test/scripts/install.contract.test.ts test/docs/readme.test.ts` → ❌ expected failures (source-mode mismatch + README npx guidance + doctor missing-key guidance assertion)
- **GREEN targeted**: `npm test -- test/notion/diagnostics.test.ts test/cli/doctor.test.ts test/cli/init.test.ts test/cli/install-mode.test.ts test/scripts/install.contract.test.ts test/docs/readme.test.ts` → ✅ 26/26
- **GREEN full suite**: `npm test` → ✅ 66/66

## Files Changed (this pass)
- `src/cli/install-mode.ts`
- `src/notion/diagnostics.ts`
- `README.md`
- `test/cli/install-mode.test.ts`
- `test/cli/doctor.test.ts`
- `test/cli/init.test.ts`
- `test/notion/diagnostics.test.ts`
- `test/scripts/install.contract.test.ts`
- `test/docs/readme.test.ts` (new)
- `openspec/changes/macos-installer-hardening/apply-progress.md`

## Quality Gate Notes
- Build was intentionally not run (constraint: never run build in this pass).
- Pre-existing lint/typecheck issue remains unchanged: `src/config/loader.ts` cannot resolve `dotenv`.

## Risks / Follow-up
- Repo-wide lint/typecheck are still blocked by the pre-existing `dotenv` dependency issue in `src/config/loader.ts`.
- README docs contract test now guards install/configure drift, but future doc rewrites should keep the mode-aware configure commands aligned with CLI behavior.
