# Design: macos-installer-hardening

## Technical Approach

Keep the existing installer/install-mode hardening intact, then add a shared Notion validation diagnostics module for post-install checks. `scripts/install.sh`, `src/cli/install-mode.ts`, `src/cli/opencode-integration.ts`, and README remain mode-aware. `init` and `doctor` will stop shaping errors ad hoc and will instead consume one reusable runner that converts missing-key, auth-permission, and transport failures into deterministic diagnostics and troubleshooting.

## Architecture Decisions

### Decision: Preserve mode-aware MCP command design

| Option | Tradeoff | Decision |
|---|---|---|
| Always write `npx -y session-vault-serve` | Works broadly, but contradicts global install flow | Reject |
| Keep mode-aware direct vs `npx` command selection | Slightly more logic, but matches real install modes | Choose |

**Rationale**: the current design already matches the proposal and installer behavior. This change broadens scope; it does NOT replace the install-mode strategy.

### Decision: Shared Notion validation runner + classifier

| Option | Tradeoff | Decision |
|---|---|---|
| Inline `try/catch` in `init` and `doctor` | Fast, but wording and buckets drift | Reject |
| Pure classifier only | Better reuse, but commands still duplicate failure handling | Reject |
| Shared runner returning structured diagnostics | One extra module, but one source of truth | Choose |

**Rationale**: the requirement is COMMON classification across `init` and `doctor`, not two similar implementations.

### Decision: Deterministic message catalog

| Option | Tradeoff | Decision |
|---|---|---|
| Surface raw SDK errors directly | Simple, but unstable and misleading | Reject |
| Map to fixed codes, summaries, and troubleshooting steps | Requires a catalog, but is testable | Choose |

**Rationale**: user-facing output must be deterministic. Raw errors become detail fields, not the primary diagnosis.

## Data Flow

```text
init -> runNotionValidation('api-key', () => notion.users.me())
     -> classify error/status/code/message
     -> { category, code, summary, detail, troubleshooting[] }
     -> print fixed guidance order -> abort

doctor -> runNotionValidation('api-key', () => notion.users.me())
       -> runNotionValidation('sessions-db', () => retrieve(id))
       -> runNotionValidation('ideas-db', () => retrieve(id))
       -> install-mode helper validates MCP command shape
       -> print ordered pass/warn/fail checks + actions
```

Classification rules: missing `NOTION_API_KEY`, `NOTION_SESSIONS_DB_ID`, or `NOTION_IDEAS_DB_ID` short-circuits to `missing-key` and skips the corresponding network call; both `init` and `doctor` reuse the same explicit env-var troubleshooting text. Notion `401/403` and permission-like API codes (`unauthorized`, `restricted_resource`, `object_not_found`) map to `auth-permission`; transport signals (`fetch failed`, timeout, DNS/TLS/socket failures) map to `transport`. A final `unknown` fallback is internal safety only.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/install.sh` | Modify | Keep trapped failure diagnostics and explicit direct-binary MCP example |
| `README.md` | Modify | Keep install-mode matrix and add `init` transport troubleshooting entry points |
| `src/cli/install-mode.ts` | Create | Shared install-mode detection and expected MCP command helpers |
| `src/notion/diagnostics.ts` | Create | Shared validation runner, classifier, and troubleshooting message catalog |
| `src/cli/init.ts` | Modify | Replace permission-only rewrite with shared validation diagnostic for API-key preflight |
| `src/cli/doctor.ts` | Modify | Consume shared diagnostics for Notion API/database checks and emit deterministic statuses |
| `src/cli/opencode-integration.ts` | Modify | Keep mode-aware MCP writing based on install-mode helper |
| `test/cli/doctor.test.ts` | Modify | Cover auth vs transport vs mismatch outcomes |
| `test/cli/opencode-integration.test.ts` | Modify | Preserve direct/npx/ambiguous mode behavior |
| `test/cli/init.test.ts` | Create | Verify `init` shows transport/auth-specific guidance |
| `test/notion/diagnostics.test.ts` | Create | Unit-test classification and fixed troubleshooting output |
| `test/scripts/install.contract.test.ts` | Create | Contract-test installer diagnostics, failing-step capture, PATH guidance, and shell-availability skip behavior |

## Interfaces / Contracts

```ts
type NotionValidationCategory = 'missing-key' | 'auth-permission' | 'transport' | 'unknown';

type NotionDiagnostic = {
  category: NotionValidationCategory;
  code: string; // e.g. notion.transport.fetch_failed
  summary: string;
  detail?: string;
  troubleshooting: string[];
};

type DoctorCheck = {
  name: string;
  level: 'pass' | 'warn' | 'fail';
  detail?: string;
  action?: string;
  code?: string;
};
```

`src/notion/diagnostics.ts` should expose one async wrapper used by both commands so the `try/catch`, missing-key short-circuiting, and bucket mapping live in one place.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Category mapping from SDK/network errors to fixed codes/messages | Vitest with mocked error objects |
| CLI-style | `init` and `doctor` ordered output/action text, including explicit missing-key guidance | Temp-dir + injected Notion factories in Vitest |
| Contract | Installer diagnostics and PATH failure text | `test/scripts/install.contract.test.ts` spawns `bash scripts/install.sh` with stubbed commands when shell exists |
| E2E | Real macOS repro | Manual smoke only; no speculative platform-specific automation |

## Migration / Rollout

No migration required. This is additive diagnostics: installer behavior stays diagnostics-first, install-mode rules stay intact, and runtime guidance becomes more precise without changing supported install methods.

## Open Questions

- [ ] None blocking.
