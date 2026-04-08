#!/usr/bin/env node

import { startServer } from '../src/mcp/server.js';

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[session-vault] Failed to start MCP server: ${message}`);
  process.exit(1);
});
