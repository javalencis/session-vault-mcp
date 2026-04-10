#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${SESSION_VAULT_PACKAGE:-session-vault}"
MIN_NODE_MAJOR=20

say() {
  printf '%b\n' "$1"
}

fail() {
  say "❌ $1" >&2
  exit 1
}

OS_NAME="$(uname -s)"

if [ "$OS_NAME" != "Linux" ] && [ "$OS_NAME" != "Darwin" ]; then
  fail "This installer currently supports Linux and macOS only. Use npm manually on your platform."
fi

command -v node >/dev/null 2>&1 || fail "Node.js is required. Install Node.js 20+ and run this script again."
command -v npm >/dev/null 2>&1 || fail "npm is required. Install npm and run this script again."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node.js 20+ is required. Current version: $(node -v)"
fi

say "➡️  Checking npm package availability for ${PACKAGE_NAME}..."
if ! npm view "$PACKAGE_NAME" version >/dev/null 2>&1; then
  fail "Package '${PACKAGE_NAME}' is not available on npm yet. Publish it first or install from source."
fi

say "➡️  Installing ${PACKAGE_NAME} globally..."
if ! npm install --global "$PACKAGE_NAME"; then
  fail "Global npm installation failed. If this is a permissions issue, use nvm/fnm or configure npm global installs without sudo."
fi

command -v session-vault >/dev/null 2>&1 || fail "Installation finished, but 'session-vault' is not available in PATH. Restart your shell and try again."
command -v session-vault-serve >/dev/null 2>&1 || fail "Installation finished, but 'session-vault-serve' is not available in PATH. Restart your shell and try again."

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
