## Exploration: macos-installer-hardening

### Current State
The new macOS report is a **post-install init failure**, not an installer failure. `scripts/install.sh` ends after verifying the package installs globally and both binaries resolve in `PATH`; it does not execute `session-vault init` or validate Notion connectivity.

The failing runtime path is in `src/cli/init.ts`: `runInitCommand()` prompts for `NOTION_API_KEY`, then `validateNotionApiKey()` calls `notion.users.me()`. Any thrown error is caught and rewritten to `Unable to validate NOTION_API_KEY. Please verify integration permissions. Details: ${reason}`. That means transport failures (`fetch failed`, TLS, CA trust, proxy, DNS, captive network) and real Notion auth/permission failures are currently collapsed into the same permissions-oriented message.

`src/cli/doctor.ts` already performs a similar `users.me()` reachability check, but it only surfaces the raw error message and the current change artifacts focus mainly on installer diagnostics, install-mode consistency, MCP command validation, and docs alignment. They do **not** yet cover init-time error classification, shared Notion connectivity diagnostics, or troubleshooting guidance for network/proxy/TLS causes on macOS.

The reported runtime is Node.js `v22.20.0`. Node documents built-in fetch env-proxy support in the v22 line starting at `v22.21.0`, so this incident is BELOW that documented threshold. That does not prove proxy is the cause, but it makes proxy-dependent environments a legitimate diagnostic branch that the current plan does not capture.

### Affected Areas
- `openspec/changes/macos-installer-hardening/proposal.md` — current scope is too installer-centric for the real incident
- `openspec/changes/macos-installer-hardening/specs/installer-diagnostics/spec.md` — missing requirements for init-time Notion validation classification and troubleshooting
- `openspec/changes/macos-installer-hardening/design.md` — missing a shared connectivity-diagnostics design for `init` and `doctor`
- `openspec/changes/macos-installer-hardening/tasks.md` — no tasks for `init` validation or transport/auth distinction
- `src/cli/init.ts` — current failure path rewrites every validation error as an integration-permissions problem
- `src/cli/doctor.ts` — current checks do not classify auth vs transport causes or guide the user through likely remediations
- `README.md` — setup docs mention permissions/share steps, but not transport-layer troubleshooting for `session-vault init`
- `test/cli/doctor.test.ts` — no coverage for transport-vs-auth classification or targeted guidance

### Approaches
1. **Keep scope installer-only** — Treat the report as future troubleshooting data, but leave the change focused on install script and MCP mode hardening.
   - Pros: Smallest planning delta; preserves the current artifact set
   - Cons: DOES NOT address the real reported failure path; leaves `init` misclassifying network errors as permissions issues; weakens the value of the change
   - Effort: Low

2. **Expand to Notion connectivity diagnostics** — Keep the installer hardening work, but extend the change so `init`, `doctor`, and docs classify and explain Notion validation failures.
   - Pros: Matches the real macOS incident; distinguishes install success from post-install init failure; improves diagnostics without guessing a platform-specific fix
   - Cons: Broadens the change beyond installer/MCP surfaces; requires refreshed proposal/spec/design/tasks
   - Effort: Medium

### Recommendation
Choose **Expand to Notion connectivity diagnostics**.

The missing planning scope is:
- explicitly split **Install** failures from **Configure / `session-vault init`** failures
- add a shared diagnostic/classification path for Notion validation used by both `init` and `doctor`
- classify at least these buckets before messaging the user: missing/invalid key format, Notion auth/permission denial, and transport/unreachable errors (`fetch failed`, TLS/CA, proxy, DNS, offline)
- change init/doctor guidance so transport errors do NOT tell users only to “verify integration permissions”
- add troubleshooting guidance that asks for environment details relevant to macOS networking (Node version, proxy env vars, VPN/corporate proxy, TLS/system CA context, DNS reachability) without asserting a macOS-only root cause
- document Node `v22.20.0` as below the v22 documented fetch env-proxy support threshold, so proxy-related cases need explicit troubleshooting instead of assumption

Actionable recommendation for downstream planning artifacts:
- revise the proposal to include **post-install Notion connectivity diagnostics** as in-scope
- extend the spec with requirements for init-time classification and user-facing remediation guidance
- update the design to introduce a shared classifier/helper instead of duplicating ad-hoc error handling in `init` and `doctor`
- add tasks/tests for `src/cli/init.ts`, `src/cli/doctor.ts`, and troubleshooting docs

### Risks
- `fetch failed` is a generic transport symptom; without better classification, the CLI will keep sending users toward the wrong fix
- Expanding the change may blur installer hardening with runtime connectivity hardening unless artifacts explicitly separate the two
- Proxy-related environments are plausible on macOS, especially with Node `v22.20.0`, but forcing a proxy-specific fix now would still be speculative
- The current repo has no `init` tests, so planning must account for a new validation surface instead of assuming doctor coverage is enough

### Ready for Proposal
Yes — but ONLY if the next proposal update broadens the change from installer/MCP hardening to include post-install Notion connectivity diagnostics for `init` and `doctor`. The orchestrator should tell the user that the real incident is NOT fully covered today and the planning artifacts must be refreshed before implementation.
