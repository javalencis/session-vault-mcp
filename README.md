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

## Quick start (from source)

This repository is ready to run locally.

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
https://www.notion.so/OpenCode-33c5ec8476df8013b45dcbe087d579f6
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

Expected MCP entry:

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
