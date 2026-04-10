import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodError } from 'zod';
import { loadConfig } from '../config/load.js';
import { NotionVaultClient } from '../notion/client.js';
import { ConfigError, NotionApiError } from '../notion/errors.js';
import { registerCaptureIdeaTool } from './tools/capture-idea.js';
import { registerSaveSessionTool } from './tools/save-session.js';
import { registerSearchTool } from './tools/search.js';
import { registerUpdateSessionTool } from './tools/update-session.js';

function readPackageVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packagePath = join(currentDir, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function startServer(): Promise<void> {
  try {
    const config = loadConfig();
    const notionClient = new NotionVaultClient(config);
    const startupWarnings = await notionClient.validateStartupSchema();
    for (const warning of startupWarnings) {
      console.warn(`⚠️ session-vault startup warning: ${warning}`);
    }

    const server = new McpServer({
      name: 'session-vault',
      version: readPackageVersion(),
    });

    registerSaveSessionTool(server, notionClient);
    registerUpdateSessionTool(server, notionClient);
    registerCaptureIdeaTool(server, notionClient);
    registerSearchTool(server, notionClient);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Configuration validation failed: ${error.issues
          .map((issue) => `${issue.path.join('.') || 'config'} ${issue.message}`)
          .join('; ')}`,
      );
    }

    if (error instanceof ConfigError) {
      throw new Error(`Missing required configuration: ${error.message}`);
    }

    if (error instanceof NotionApiError) {
      throw new Error(`Notion is unreachable or misconfigured: ${error.message}`);
    }

    const message = error instanceof Error ? error.message : 'Unknown startup error';
    throw new Error(`Failed to start MCP server: ${message}`);
  }
}
