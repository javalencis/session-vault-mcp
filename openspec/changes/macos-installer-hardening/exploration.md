## Exploration: macos-installer-hardening

### Current State
`session-vault` is distributed as an npm package (`package.json`) targeting Node 20+ with two published binaries: `session-vault` and `session-vault-serve`. `npm pack --dry-run` shows the tarball currently ships `dist/`, `README.md`, `LICENSE`, `.env.example`, and `package.json`, so the install surface depends on prebuilt `dist` assets already being present at publish time.

Installation is documented in three ways:
- raw GitHub installer: `curl .../scripts/install.sh | bash`
- npm usage: `npx session-vault init` / `npm install -g session-vault`
- source flow: clone, build, and `npm link`

The Linux/macOS installer (`scripts/install.sh`) only checks `uname`, `node`, `npm`, npm package availability, global install success, and whether both binaries resolve in `PATH`. After install, it prints manual next steps instead of configuring Notion or OpenCode automatically.

The OpenCode flow is split across docs and CLI code. `src/cli/opencode-integration.ts` writes an MCP entry using `['npx', '-y', 'session-vault-serve']`, while the installer output and one README example also describe direct execution via `['session-vault-serve']`. `src/cli/doctor.ts` only checks whether a `session-vault` MCP entry exists; it does not validate that the command shape matches the chosen install method.

### Affected Areas
- `package.json` — defines Node requirement, published bins, and which files are shipped to npm
- `scripts/install.sh` — current Linux/macOS install path and all install-time diagnostics
- `README.md` — documents installer, global npm flow, `npx` flow, and OpenCode examples
- `src/cli/opencode-integration.ts` — writes the generated OpenCode MCP command
- `src/cli/doctor.ts` — current post-install validation surface
- `test/cli/opencode-integration.test.ts` — locks current generated MCP command behavior
- `test/cli/doctor.test.ts` — covers presence checks but not install-method correctness

### Approaches
1. **Diagnostics-first hardening** — Keep the current install methods, but tighten observability and consistency before changing behavior.
   - Pros: Does not assume a fake macOS root cause; improves future debugging immediately; lower blast radius
   - Cons: May not fix the eventual root cause by itself; still depends on users providing logs
   - Effort: Medium

2. **Installer behavior redesign** — Change the install/OpenCode strategy now (for example, standardize on one invocation model and reshape installer behavior).
   - Pros: Could reduce ambiguity between global install and generated MCP config
   - Cons: Too speculative without a real failing macOS log; higher regression risk; can “fix” the wrong problem
   - Effort: High

### Recommendation
Choose **Diagnostics-first hardening** as the next change scope. The repo already shows real portability assumptions and visibility gaps: the shell installer lives outside the npm tarball, the raw GitHub script can drift from the published package, OpenCode examples are not fully aligned across docs/code, and doctor checks only presence instead of executable correctness. That is enough evidence to justify a hardening change WITHOUT pretending we know the macOS root cause.

Recommended proposal scope:
- add install-time diagnostics that capture actionable context on failure (OS, shell, Node/npm versions, npm prefix/path-related context, failing step)
- document the supported install flows and when each MCP command form is expected
- validate or at least surface install-method mismatches in `doctor`
- add test coverage around installer/packaging assumptions where feasible without inventing platform-specific behavior
- explicitly defer any macOS-specific fix until a real failing log is captured

### Risks
- The raw installer is fetched from GitHub `main`, while the package is installed from npm `latest`; those two versions can drift
- `npm install --global` plus `PATH` resolution is a fragile boundary, especially because the script only reports generic permission/PATH failures
- OpenCode integration guidance is split between direct binary execution and `npx`, which can make macOS issue reports ambiguous
- The code assumes OpenCode global config lives at `~/.config/opencode/opencode.json`; that assumption should be validated against real macOS environments instead of treated as fact
- No installer-specific or macOS-specific automated smoke coverage was found in the repo
- `doctor` cannot currently distinguish “entry exists” from “entry will actually execute with this install method”

### Ready for Proposal
Yes — if the proposal is limited to diagnostics, validation, packaging/install-surface consistency, and explicit open questions. The next session should NOT propose a platform-specific fix until it has a real macOS failure command/log.
