# Tasks: macos-installer-hardening

## Phase 1: Shared install-mode foundation

- [x] 1.1 RED: add `test/cli/install-mode.test.ts` for `global` / `npx` / `source` detection, expected MCP command arrays, and mismatch parsing. AC: tests fail first and assert direct binary vs `npx -y` outcomes.
- [x] 1.2 GREEN: create `src/cli/install-mode.ts` with reusable install-mode detection, expected-command helpers, and MCP-shape validation consumed by CLI commands. AC: task 1.1 passes without duplicating command rules elsewhere.

## Phase 2: OpenCode integration wiring

- [x] 2.1 RED: extend `test/cli/opencode-integration.test.ts` for global-install direct binary, npx command, and ambiguous config-target flows. AC: preserved JSON and exact `mcp["session-vault"].command` arrays are asserted.
- [x] 2.2 GREEN: update `src/cli/opencode-integration.ts` to use `src/cli/install-mode.ts` and write mode-aware MCP entries. AC: global installs write `['session-vault-serve']`; npx flows write `['npx','-y','session-vault-serve']`; ambiguous config choice remains explicit.

## Phase 3: Shared Notion diagnostics foundation

- [x] 3.1 RED: create `test/notion/diagnostics.test.ts` for `missing-key`, `auth-permission`, `transport`, and deterministic troubleshooting text. AC: missing `NOTION_API_KEY` / DB IDs short-circuit without network calls; 401/403, `restricted_resource`, `object_not_found`, and `fetch failed` map to stable codes.
- [x] 3.2 GREEN: create `src/notion/diagnostics.ts` with shared runner, classifier, and message catalog for `init`/`doctor`. AC: exports structured diagnostics, classifies missing-key explicitly, and reuses the same env-var + transport guidance in both commands.

## Phase 4: Init connectivity diagnostics

- [x] 4.1 RED: create `test/cli/init.test.ts` covering API-key success, missing API key, auth denial, and transport failure guidance. AC: missing-key skips network calls; transport is not mislabeled as permissions and includes Node/proxy troubleshooting text.
- [x] 4.2 GREEN: update `src/cli/init.ts` to call `src/notion/diagnostics.ts` for API-key validation before database prompts. AC: init aborts with deterministic summary/detail/troubleshooting for missing-key, auth-permission, and transport outcomes.

## Phase 5: Doctor diagnostics and installer hardening

- [x] 5.1 RED: expand `test/cli/doctor.test.ts` for MCP shape pass/warn/fail plus missing API key, missing sessions/ideas DB IDs, auth, and transport diagnostics. AC: output distinguishes install-method mismatch, missing-key short-circuits, and doctor-specific network/proxy troubleshooting text.
- [x] 5.2 GREEN: update `src/cli/doctor.ts` to consume shared diagnostics and install-mode helpers. AC: doctor emits ordered pass/warn/fail checks with stable codes, explicit missing env-var actions, skipped network calls for missing keys, and transport troubleshooting beyond `init`.
- [x] 5.3 RED: add `test/scripts/install.contract.test.ts` for missing deps, failed global install, PATH resolution failure, and success guidance (skip when `bash` is unavailable). AC: assertions cover failing step, OS/shell/Node/npm/npm prefix, and expected global bin path text.
- [x] 5.4 GREEN: harden `scripts/install.sh` to print trapped step diagnostics, environment snapshot, PATH guidance, and direct-binary MCP example. AC: all task 5.3 scenarios pass with non-zero exits on failures.

## Phase 6: Documentation and verification polish

- [x] 6.1 Update `README.md` to separate Install vs Configure, document global / npx / source flows, add missing-key + transport troubleshooting for `init` and `doctor`, and reference `session-vault doctor`. AC: docs match installer output, doctor diagnostics, and mode-aware MCP examples.
