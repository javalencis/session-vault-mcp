# Proposal: macos-installer-hardening

## Intent

Improve installer diagnostics AND post-install Notion connectivity diagnostics to facilitate troubleshooting macOS-specific issues without prematurely guessing root causes. The reported macOS incident is an `init` failure (`fetch failed` on Node v22.20.0), not an installer script failure. We need to stop collapsing network/transport errors into "permission" errors, while maintaining existing plans to harden installer output and MCP command shape.

## Scope

### In Scope
- Add install-time diagnostics (OS, shell, Node/npm versions, failing step)
- Clarify supported install flows (global npm, npx, linked) in docs and CLI
- Add `init` and `doctor` Notion connectivity diagnostics and error classification
- Differentiate transport/network errors (e.g., `fetch failed`, proxy, TLS) from Notion auth/permission errors
- Provide targeted troubleshooting guidance for network/proxy causes (relevant for Node < v22.21.0)
- Add test coverage for new diagnostic paths

### Out of Scope
- Implementing speculative macOS-specific fixes for installation or networking
- Changing the primary installation method away from npm

## Capabilities

### New Capabilities
- `installer-diagnostics`: Diagnostics-first hardening and validation for session-vault installation flows.
- `connectivity-diagnostics`: Shared classification for Notion validation errors across `init` and `doctor`.

### Modified Capabilities
None

## Approach

Implement a **Diagnostics-first hardening** strategy for both install and runtime:
1. **Installer**: Update `scripts/install.sh` to capture actionable environment data on failure.
2. **Runtime Connectivity**: Introduce a shared classifier/helper for Notion validation to be used by both `init` and `doctor`. This classifier will categorize errors into missing keys, auth/permission denials, and transport/unreachable errors (like proxy or TLS issues), preventing `init` from rewriting all failures as permission problems.
3. **Docs**: Ensure documentation aligns with MCP command forms and includes transport-layer troubleshooting for `session-vault init`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/install.sh` | Modified | Add detailed diagnostics and failing step reporting |
| `src/notion/diagnostics.ts` | New | Shared classifier for Notion API connectivity, auth, and transport errors |
| `src/cli/install-mode.ts` | New | Helper to detect and explicitly manage the current installation method |
| `src/cli/init.ts` | Modified | Use shared classifier to stop rewriting network errors as permission issues |
| `src/cli/doctor.ts` | Modified | Validate install method mismatch and use shared Notion connectivity classifier |
| `src/cli/opencode-integration.ts` | Modified | Ensure command shape is explicit based on install mode |
| `README.md` | Modified | Clarify install flows and add transport-layer troubleshooting for `init` |
| `test/cli/` | New/Modified | Add coverage for install assumptions, doctor checks, and init classification |
| `test/scripts/` | New | Add contract coverage for install script behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `PATH` resolution fragility | High | Explicitly surface path resolution issues in diagnostics |
| Misclassifying transport errors | Medium | Create strict error buckets for HTTP 401/403 vs fetch/network errors |
| Scope blur (install vs runtime) | Low | Keep installer and connectivity diagnostics as separate capabilities |
| Breaking existing installations | Low | Changes are additive diagnostics and validation, not destructive |

## Rollback Plan

Revert changes to `scripts/install.sh`, `src/cli/init.ts`, `src/cli/doctor.ts`, and `src/cli/opencode-integration.ts`. Restore `README.md` to previous state. Remove the new shared classifier.

## Dependencies

- None

## Success Criteria

- [ ] Installer script provides actionable environment data on failure
- [ ] `session-vault init` correctly classifies transport (`fetch failed`) vs permission errors
- [ ] `doctor` command correctly surfaces install-method mismatches and connectivity status
- [ ] Documentation includes troubleshooting for transport/proxy failures during `init`
- [ ] No new speculative macOS-specific behavior is introduced