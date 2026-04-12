# Design: macos-installer-hardening

## Technical Approach

Harden the install surface by making **install mode** explicit across `scripts/install.sh`, `README.md`, OpenCode config generation, and `doctor`. The change stays diagnostics-first: add better failure context and mode-aware guidance, but do not introduce speculative macOS fixes or an auto-configuring installer.

## Architecture Decisions

### Decision: Mode-aware MCP command

| Option | Tradeoff | Decision |
|---|---|---|
| `session-vault-serve` direct | Fast, version-stable, requires binary in `PATH` | Default for installer/global/npm-link flows |
| `npx -y session-vault-serve` | Works without global binary, may fetch at runtime | Default only for npx-driven usage or explicit fallback |

**Rationale**: the installer already performs `npm install -g` and verifies `session-vault-serve` in `PATH`, so direct execution is the correct default there. `npx` remains supported for users who never install globally.

### Decision: Shared install-mode helper

| Option | Tradeoff | Decision |
|---|---|---|
| Duplicate rules in CLI modules | Quick, but drifts | Reject |
| Small shared helper (`src/cli/install-mode.ts`) | One more file, but single source of truth | Choose |

**Rationale**: `doctor` and OpenCode patching must classify the same modes and expected command forms.

### Decision: Actionable diagnostics, not auto-fixers

| Option | Tradeoff | Decision |
|---|---|---|
| Boolean checks only | Simple, weak guidance | Reject |
| Full configurator | Powerful, too invasive/speculative | Reject |
| Diagnostic objects with severity + next action | Slightly richer output | Choose |

**Rationale**: users need clear remediation without the installer mutating unrelated config.

## Data Flow

```text
install.sh -> prints diagnostics + direct-mode MCP example
init/opencode-integration -> detect install mode -> write matching MCP command
doctor -> read OpenCode MCP entry -> parse command -> compare against expected mode -> pass/warn/fail + action
README -> documents same mode matrix used by CLI
```

Mode detection should classify `direct-binary`, `npx-package`, or `unknown` using current invocation evidence (`process.argv[1]` / npm cache hints) plus binary availability. If detection is ambiguous, `patchOpenCodeConfig` should ask one focused choice (`direct` vs `npx`) instead of silently guessing.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/install.sh` | Modify | Add trapped failing-step reporting and environment snapshot (`uname`, shell, `node -v`, `npm -v`, `npm prefix -g`, resolved bin paths); keep behavior additive |
| `README.md` | Modify | Replace mixed examples with an install-mode matrix and one recommended MCP command per mode |
| `src/cli/install-mode.ts` | Create | Shared mode detection, expected-command helpers, command parsing/comparison |
| `src/cli/opencode-integration.ts` | Modify | Generate MCP entry from detected/selected mode and log why that mode was chosen |
| `src/cli/doctor.ts` | Modify | Upgrade MCP validation from “entry exists” to “entry is present, executable, and aligned with install mode expectations” |
| `test/cli/install-mode.test.ts` | Create | Unit coverage for detection and command comparison |
| `test/cli/opencode-integration.test.ts` | Modify | Cover direct, npx, and ambiguous-mode prompt behavior |
| `test/cli/doctor.test.ts` | Modify | Cover pass/warn/fail outcomes for matching, mismatched, and broken MCP commands |
| `test/scripts/install.contract.test.ts` | Create | Node-driven contract test that spawns `bash` with stubbed `PATH`; skipped when `bash` is unavailable |

## Interfaces / Contracts

```ts
type InstallMode = 'direct-binary' | 'npx-package' | 'unknown';

type DoctorDiagnostic = {
  name: string;
  level: 'pass' | 'warn' | 'fail';
  detail?: string;
  action?: string;
};
```

`doctor` rules:
- missing MCP entry -> `fail`
- command matches expected mode -> `pass`
- alternate but still viable form -> `warn` with replacement example
- malformed/unexecutable form -> `fail`

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Mode detection, command parsing, mismatch classification | Vitest pure-function tests |
| Integration | Config patching preserves JSON and writes mode-correct MCP command | Temp-dir file tests in existing CLI style |
| Contract | Installer diagnostics/guidance text | Spawn `bash scripts/install.sh` with fake `node`/`npm`/`uname`; skip when shell unavailable |
| E2E | Real macOS verification | Manual smoke only after a real failing log exists |

## Migration / Rollout

No migration required. Existing direct and `npx` entries remain supported; only clearly broken entries should fail. Roll out as additive diagnostics plus docs alignment.

## Open Questions

- [ ] Validate with a real macOS failure log whether `~/.config/opencode/opencode.json` is always the correct global config path.
