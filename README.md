# session-vault

CLI + MCP server to persist coding sessions and ideas to Notion.

`session-vault` is designed to work with OpenCode through MCP so an agent can save useful session history, capture ideas, and search past work without turning your Notion workspace into noise.

## What it does

- Creates and manages two Notion databases: **Sessions** and **Ideas**
- Exposes MCP tools for OpenCode:
  - `save_session`
  - `update_session`
  - `capture_idea`
  - `search_memories`
- Applies deterministic quality scoring before saving sessions
- Warns on likely duplicates instead of silently creating more clutter
- Provides a CLI setup flow for Notion + OpenCode integration

## Requirements

- Node.js **20+**
- A Notion integration with access to the target page/databases
- OpenCode installed and configured locally

## Install

### Installer script (Linux/macOS)

Linux and macOS users can install with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/javalencis/session-vault-mcp/main/scripts/install.sh | bash
```

What this installer does:

- verifies Linux/macOS support
- verifies `node` and `npm`
- installs `session-vault` globally from npm
- verifies that `session-vault` and `session-vault-serve` are available
- prints failing-step diagnostics (OS, shell, Node/npm versions, npm global prefix)
- prints the next commands as a short tutorial

What it does **not** do:

- it does not auto-run `session-vault init`
- it does not ask for your Notion credentials during installation
- it does not modify your setup without you explicitly running the next steps

If you want to pin the installer to a specific release, replace `main` with a tag like `v0.1.1`.

### npm global install (direct binary mode)

```bash
npm install -g session-vault
session-vault init
session-vault doctor
```

OpenCode MCP command for global install:

```json
{
  "mcp": {
    "session-vault": {
      "type": "local",
      "command": ["session-vault-serve"],
      "enabled": true
    }
  }
}
```

### npm npx usage (npx mode)

```bash
npx session-vault init
npx session-vault doctor
```

OpenCode MCP command for npx usage:

```json
{
  "mcp": {
    "session-vault": {
      "type": "local",
      "command": ["npx", "-y", "session-vault-serve"],
      "enabled": true
    }
  }
}
```

### From source (linked/source mode)

This repository is ready to run locally:

```bash
git clone https://github.com/javalencis/session-vault-mcp.git
cd session-vault-mcp
npm install
npm run build
npm link
```

After `npm link`, these commands become available globally on your machine:

- `session-vault`
- `session-vault-serve`

When linked from source, use the same direct-binary MCP command as global mode:

```json
{
  "mcp": {
    "session-vault": {
      "type": "local",
      "command": ["session-vault-serve"],
      "enabled": true
    }
  }
}
```

## Configure

Use the configure commands that match how you installed the CLI:

- global install or linked source mode:

```bash
session-vault init
session-vault doctor
```

- npx mode:

```bash
npx session-vault init
npx session-vault doctor
```

If configuration fails, run the matching `doctor` command for your mode to see deterministic pass/warn/fail diagnostics and next-step guidance.

## Notion setup

1. Go to [Notion integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Grant at least these capabilities:
   - **Read content**
   - **Insert content**
   - **Update content**
4. Create or choose a Notion page that will contain the databases
5. Share that page with your integration using **Connections**
6. Copy your integration secret (`NOTION_API_KEY`)
7. Copy the page ID from the URL

Example page URL:

```txt
https://www.notion.so/mock-33c5ee8476df8013b45dcbe087d579f6
```

Page ID:

```txt
33c5ec84-76df-8013-b45d-cbe087d579f6
```

## CLI commands

### `session-vault init`

Runs the interactive setup wizard.

It will:

- validate `NOTION_API_KEY`
- create new Notion databases or connect existing ones
- save config to:

```txt
~/.config/session-vault/config.json
```

- write `NOTION_API_KEY` into a local `.env` in the current directory
- optionally patch OpenCode config so MCP can discover `session-vault`

Run:

```bash
session-vault init
```

If `init` fails before database prompts:
 
 - `notion.missing_key.NOTION_API_KEY`: set `NOTION_API_KEY` in env or `~/.config/session-vault/config.json`
 - `notion.auth_permission.*`: integration token exists but lacks permissions/share access
 - `notion.transport.fetch_failed`: network/proxy/TLS issue. If on a corporate VPN/proxy (especially macOS), run `NODE_USE_SYSTEM_CA=1 session-vault init` to bypass TLS interception. OpenCode MCP will also be automatically configured with this flag.

After fixing the issue, run `session-vault doctor`.

### `session-vault doctor`

Runs health checks for:

- global config presence
- Notion API key
- Notion API access
- Sessions database access
- Ideas database access
- OpenCode MCP config presence

Run:

```bash
session-vault doctor
```

Doctor now reports deterministic `pass` / `warn` / `fail` checks including:

- install-mode MCP command mismatch (`mcp.command.mismatch`)
- invalid MCP command shape (`mcp.command.invalid_shape`)
- missing API key / DB IDs without network calls (`notion.missing_key.*`)
- auth-permission failures (`notion.auth_permission.*`)
- transport failures with network/proxy guidance (`notion.transport.fetch_failed`)
- schema drift in `Sessions` / `Ideas`, including Notion workspaces that expose properties through `data_sources`

Notes:

- New databases created with `session-vault setup-notion` include the expected schema automatically.
- Older or manually connected databases may still warn about real missing properties, for example `Status` in `Sessions`.
- `update_session` tolerates older `Sessions` databases without `Status`, but `doctor` will still warn so you can align the schema intentionally.

### `session-vault setup-notion`

Creates the `Sessions` and `Ideas` databases under a parent page.

```bash
session-vault setup-notion --parent-page-id <NOTION_PAGE_ID>
```

## Configuration

`session-vault` uses this precedence order:

```txt
env vars > global config > defaults
```

Supported environment variables:

- `NOTION_API_KEY`
- `NOTION_SESSIONS_DB_ID`
- `NOTION_IDEAS_DB_ID`
- `NOTION_PARENT_PAGE_ID`

Global config path:

```txt
~/.config/session-vault/config.json
```

## OpenCode integration

The setup flow can patch OpenCode automatically.

Depending on what exists on your machine, it will update either:

- project config: `./opencode.json`
- global config: `~/.config/opencode/opencode.json`

Expected MCP entry after installation (`npm link` or global npm install):

```json
{
  "mcp": {
    "session-vault": {
      "type": "local",
      "command": ["session-vault-serve"],
      "enabled": true
    }
  }
}
```

After updating OpenCode config, restart OpenCode so it reloads MCP servers.

## MCP tools

### `save_session`

Saves a coding session to Notion with deterministic scoring and duplicate warnings.

Input fields:

- `title`
- `goal?`
- `summary`
- `decisions?`
- `nextSteps?`
- `tags?`
- `project?`
- `source?` (`opencode`, `claude-code`, `manual`)

### `update_session`

Updates an existing session by `sessionKey` and can append content to the page.

Input fields:

- `sessionKey` or `session_key`
- `title?`
- `goal?`
- `summary?`
- `decisions?`
- `nextSteps?`
- `tags?`
- `status?` (optional; ignored automatically when the connected `Sessions` database does not include `Status`)
- `appendContent?`

### `capture_idea`

Captures an idea in Notion and can optionally link it to a saved session.

Input fields:

- `title`
- `description?`
- `confidence?` (`0` to `1`)
- `tags?`
- `sessionKey?`

### `search_memories`

Searches stored sessions and ideas.

Input fields:

- `query`
- `type?` (`session`, `idea`, `all`)
- `limit?`

## Quality scoring

Sessions are not saved blindly.

Current scoring rules:

- `+2` if there is at least one decision
- `+2` if summary length is greater than 50 characters
- `+1` if there are next steps
- `+1` if tags exist or project is set
- `-1` if summary length is under 20 characters
- `-2` for generic titles like `session`, `test`, `prueba`, `sesion`, `untitled`

Thresholds:

- `>= 3` → save
- `== 2` → save with low-quality warning
- `<= 1` → reject

## Notion schema

### Sessions

- `Title`
- `Session Key`
- `Goal`
- `Status`
- `Summary`
- `Decisions`
- `Next Steps`
- `Tags`
- `Project`
- `Source`

### Ideas

- `Title`
- `Description`
- `Tags`
- `Project`
- `Session Relation`

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Typecheck

```bash
npm run typecheck
```

### Run CLI from source

```bash
node dist/cli.js --help
```

### Run MCP server manually

```bash
session-vault-serve
```

This process waits on stdio because it is meant to be started by an MCP client such as OpenCode.

## Publishing checklist

Before publishing to npm:

1. Ensure `package.json` version is correct
2. Ensure the repo is clean and pushed
3. Run `npm pack` and verify package contents
4. Login to npm with `npm login`
5. Publish with:

```bash
npm publish --access public
```

After publishing, create and push the release tag:

```bash
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

## Current status

The project is functional locally and has already been validated against a real Notion workspace and OpenCode configuration.

Main things already solved:

- Notion API 2026-03-11 compatibility
- automatic `database_id -> data_source_id` resolution
- OpenCode global config detection
- MCP startup outside the project root
- real session persistence to Notion

## License

[MIT](./LICENSE)
