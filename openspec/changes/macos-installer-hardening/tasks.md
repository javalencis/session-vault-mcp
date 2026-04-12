# Tasks: macos-installer-hardening

## Phase 1: Install-mode foundation

- [ ] 1.1 RED: add `test/cli/install-mode.test.ts` for mode detection, MCP command parsing, and mismatch classification. Files: `test/cli/install-mode.test.ts`. AC: direct / npx / unknown inputs fail first and map to the design contract.
- [ ] 1.2 GREEN: create `src/cli/install-mode.ts` with shared `InstallMode` helpers used by CLI surfaces. Files: `src/cli/install-mode.ts`. AC: exports mode detection + expected-command helpers that satisfy task 1.1 without duplicating rules elsewhere.

## Phase 2: OpenCode config consistency

- [ ] 2.1 RED: extend `test/cli/opencode-integration.test.ts` for direct-binary, npx-package, and ambiguous-mode prompt flows. Files: `test/cli/opencode-integration.test.ts`. AC: tests assert preserved JSON plus the exact command array written for each mode.
- [ ] 2.2 GREEN: update `src/cli/opencode-integration.ts` to use `install-mode` helpers and ask one focused choice when detection is ambiguous. Files: `src/cli/opencode-integration.ts`, `src/cli/install-mode.ts`. AC: written MCP entry matches detected/selected mode and logs why that mode was chosen.

## Phase 3: Doctor diagnostics hardening

- [ ] 3.1 RED: expand `test/cli/doctor.test.ts` for matching, viable-alternate, malformed, and missing MCP command shapes. Files: `test/cli/doctor.test.ts`. AC: tests cover pass / warn / fail outcomes and recommended replacement text.
- [ ] 3.2 GREEN: refactor `src/cli/doctor.ts` to emit actionable diagnostics for MCP presence, executability, and install-mode alignment. Files: `src/cli/doctor.ts`, `src/cli/install-mode.ts`. AC: doctor reports valid entries as pass, viable mismatches as warn, and broken forms as fail.

## Phase 4: Installer contract hardening

- [ ] 4.1 RED: add `test/scripts/install.contract.test.ts` for missing deps, failed global install, PATH resolution failure, and success guidance; skip when `bash` is unavailable. Files: `test/scripts/install.contract.test.ts`. AC: contract checks assert diagnostic fields and step-specific failure messages from the script.
- [ ] 4.2 GREEN: harden `scripts/install.sh` with trapped failing-step reporting, environment snapshot, PATH guidance, and success output aligned to direct-binary mode. Files: `scripts/install.sh`. AC: failure paths print OS, shell, Node, npm, npm prefix, resolved bins or missing dependency detail, and exit non-zero.

## Phase 5: Docs and troubleshooting alignment

- [ ] 5.1 Update install/configure docs and troubleshooting to mirror real CLI behavior and mode matrix. Files: `README.md`, `scripts/install.sh`. AC: README separates Install vs Configure, documents global / npx / source flows, includes `doctor` entry points, and matches generated MCP command examples.
