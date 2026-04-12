#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${SESSION_VAULT_PACKAGE:-session-vault}"
MIN_NODE_MAJOR=20
CURRENT_STEP="bootstrap"
OS_NAME="${SESSION_VAULT_INSTALL_OS_NAME:-$(uname -s)}"

say() {
  printf '%b\n' "$1"
}

safe_cmd_output() {
  local output
  if output="$($1 ${2:-} ${3:-} 2>/dev/null)"; then
    printf '%s' "$output"
  else
    printf 'unavailable'
  fi
}

print_snapshot() {
  local npm_prefix
  npm_prefix="$(npm prefix -g 2>/dev/null || true)"
  if [ -z "$npm_prefix" ]; then
    npm_prefix="unavailable"
  fi

  say ""
  say "Installer diagnostics:"
  say "  Failed step: ${CURRENT_STEP}"
  say "  OS: ${OS_NAME}"
  say "  Shell: ${SHELL:-unknown}"
  say "  Node: $(safe_cmd_output node -v)"
  say "  npm: $(safe_cmd_output npm -v)"
  say "  npm global prefix: ${npm_prefix}"
}

fail() {
  local message="$1"
  local code="${2:-1}"

  say ""
  say "❌ ${message}" >&2
  print_snapshot >&2
  exit "$code"
}

on_error() {
  local exit_code="$?"
  fail "Install script failed unexpectedly." "$exit_code"
}

trap on_error ERR

if [ "$OS_NAME" != "Linux" ] && [ "$OS_NAME" != "Darwin" ]; then
  CURRENT_STEP="platform-check"
  fail "This installer currently supports Linux and macOS only. Use npm manually on your platform."
fi

CURRENT_STEP="dependency-check:node"
command -v node >/dev/null 2>&1 || fail "Node.js is required. Install Node.js 20+ and run this script again."

CURRENT_STEP="dependency-check:npm"
command -v npm >/dev/null 2>&1 || fail "npm is required. Install npm and run this script again."

CURRENT_STEP="node-version-check"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node.js 20+ is required. Current version: $(node -v)"
fi

CURRENT_STEP="npm-view-package"
say "➡️  Checking npm package availability for ${PACKAGE_NAME}..."
npm view "$PACKAGE_NAME" version >/dev/null 2>&1

CURRENT_STEP="npm-install-global"
say "➡️  Installing ${PACKAGE_NAME} globally..."
npm install --global "$PACKAGE_NAME"

CURRENT_STEP="verify-path:session-vault"
if ! command -v session-vault >/dev/null 2>&1; then
  GLOBAL_BIN="$(npm prefix -g 2>/dev/null)/bin"
  fail "Installation finished, but 'session-vault' is not available in PATH. Expected global bin path: ${GLOBAL_BIN}"
fi

CURRENT_STEP="verify-path:session-vault-serve"
if ! command -v session-vault-serve >/dev/null 2>&1; then
  GLOBAL_BIN="$(npm prefix -g 2>/dev/null)/bin"
  fail "Installation finished, but 'session-vault-serve' is not available in PATH. Expected global bin path: ${GLOBAL_BIN}"
fi

CURRENT_STEP="completed"

say ""
say "✅ session-vault installed successfully"
say ""
say "What the installer did:"
say "  1. Verified Linux/macOS support"
say "  2. Verified Node.js $(node -v) and npm $(npm -v)"
say "  3. Installed ${PACKAGE_NAME} globally"
say "  4. Verified that 'session-vault' and 'session-vault-serve' are available"
say ""
say "Next steps (run these when YOU are ready):"
say "  1. Create a Notion integration: https://www.notion.so/my-integrations"
say "  2. Share a Notion page with that integration"
say "  3. Run: session-vault init"
say "  4. Verify everything: session-vault doctor"
say "  5. Restart OpenCode after MCP config changes"
say ""
say "Suggested OpenCode MCP entry after install:"
cat <<'EOF'
{
  "mcp": {
    "session-vault": {
      "type": "local",
      "command": ["session-vault-serve"],
      "enabled": true
    }
  }
}
EOF
