# Connectivity Diagnostics Specification

## Purpose
Provides shared classification for Notion validation errors across `init` and `doctor` commands, clearly distinguishing between transport/network failures and auth/permission denials.

## Requirements

### Requirement: Classify Notion Errors
The system MUST classify Notion validation errors into strict categories: missing keys, auth/permission denials, and transport/network errors.

#### Scenario: Network transport failure occurs
- GIVEN the user runs `session-vault init` or `session-vault doctor`
- WHEN a network error occurs (e.g., `fetch failed`)
- THEN the system MUST classify the error as a transport/network failure
- AND the system MUST NOT rewrite or surface the error as an auth/permission problem

#### Scenario: Authentication is denied by Notion
- GIVEN the user runs `session-vault init` or `session-vault doctor`
- WHEN Notion returns an HTTP 401 or 403 error
- THEN the system MUST classify the error as an auth/permission denial

#### Scenario: Missing API keys or identifiers
- GIVEN the user runs `session-vault init` or `session-vault doctor`
- WHEN the Notion API key or database ID is missing from the environment
- THEN the system MUST classify the error as missing keys
- AND the system MUST NOT attempt network requests

### Requirement: Provide Targeted Troubleshooting
The system MUST provide targeted troubleshooting guidance based on the specific error classification.

#### Scenario: Transport error is classified
- GIVEN a transport/network error has been classified
- WHEN the error is surfaced to the user
- THEN the CLI MUST output actionable troubleshooting guidance for network/proxy causes
- AND the guidance MUST be explicitly provided by both `init` and `doctor` commands
- AND the guidance MUST be relevant for Node versions prior to v22.21.0 where applicable

#### Scenario: Missing keys error is classified
- GIVEN a missing keys error has been classified
- WHEN the error is surfaced to the user
- THEN the CLI MUST explicitly output guidance to set the required Notion environment variables
- AND the guidance MUST be explicitly provided by both `init` and `doctor` commands

### Requirement: Validate Install Method Consistency
The system MUST validate that the current execution context matches the expected installation method and surface mismatches.

#### Scenario: Doctor command detects mismatch
- GIVEN the user runs `session-vault doctor`
- WHEN the actual installation method differs from the expected or documented method
- THEN the command MUST surface the install-method mismatch as a warning or error

### Requirement: Verifiable Connectivity Behavior
The system MUST provide verifiable output for `init` and `doctor` that allows automated testing of error classifications.

#### Scenario: Testing network failure classification
- GIVEN the system is running in a test environment
- WHEN a mocked network failure is injected during `init` or `doctor`
- THEN the command output MUST explicitly contain the network transport error classification
