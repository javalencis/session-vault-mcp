# Installer Diagnostics Specification

## Purpose
Diagnostics-first hardening and validation for session-vault installation flows, ensuring users get actionable environment data on failure rather than silent errors.

## Requirements

### Requirement: Actionable Installer Diagnostics
The install script (`scripts/install.sh`) MUST capture and report actionable environment data on failure.

#### Scenario: Installation fails due to missing dependencies
- GIVEN the user runs the install script
- WHEN `node` or `npm` is missing from the environment
- THEN the script MUST report the missing dependency explicitly
- AND the script MUST exit with a non-zero code

#### Scenario: Installation fails during global npm install
- GIVEN the user runs the install script
- WHEN `npm install -g session-vault` fails
- THEN the script MUST print the OS, shell, Node version, npm version, and npm global prefix
- AND the script MUST clearly state that the global install step failed

#### Scenario: Binary PATH resolution failure
- GIVEN the user runs the install script
- WHEN the global install succeeds but `session-vault` or `session-vault-serve` cannot be found in `PATH`
- THEN the script MUST report the `PATH` resolution failure
- AND provide the user with the expected global installation path

### Requirement: Install Mode Consistency and MCP Command Shape
The system MUST distinguish between install modes (global, npx, source) and generate/validate valid OpenCode MCP command forms for each.

#### Scenario: OpenCode integration with global install
- GIVEN the user has installed `session-vault` globally
- WHEN configuring OpenCode integration
- THEN the expected MCP command shape SHOULD use the direct binary `['session-vault-serve']`

#### Scenario: OpenCode integration with npx usage
- GIVEN the user is running `session-vault` via `npx`
- WHEN configuring OpenCode integration
- THEN the expected MCP command shape MUST use `['npx', '-y', 'session-vault-serve']`

### Requirement: Doctor Command Enhancements
The `doctor` command MUST verify the configured MCP command shape against the expected install mode.

#### Scenario: Valid MCP command shape
- GIVEN the `doctor` command is run
- WHEN the OpenCode config contains a `session-vault` entry
- AND the command shape matches a valid install mode
- THEN `doctor` MUST report the integration as valid

#### Scenario: Invalid MCP command shape
- GIVEN the `doctor` command is run
- WHEN the OpenCode config contains a `session-vault` entry
- AND the command shape does NOT match any known valid install mode
- THEN `doctor` MUST report an actionable mismatch warning

### Requirement: Documentation Clarity
The documentation MUST clearly separate installation from configuration and define troubleshooting entry points.

#### Scenario: User reads README for installation
- GIVEN the user views `README.md`
- WHEN looking for setup instructions
- THEN they MUST find a clear separation between "Install" (global, npx, source) and "Configure" (`session-vault init`) steps
- AND they MUST find documented troubleshooting entry points including the `doctor` command

### Requirement: Verification and Testing
Automated tests MUST verify installer-related decision logic and doctor validation.

#### Scenario: Testing doctor validation
- GIVEN the test suite is run
- WHEN testing `src/cli/doctor.ts`
- THEN there MUST be tests covering valid and invalid MCP command shapes
