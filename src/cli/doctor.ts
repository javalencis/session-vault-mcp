import { Client } from '@notionhq/client';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_GLOBAL_CONFIG_PATH } from '../config/load.js';
import { globalConfigSchema } from '../config/schema.js';
import {
  detectInstallModeFromArgv,
  parseMcpCommandShape,
  type InstallMode,
  type ParsedMcpCommandMode,
  validateMcpCommandShape,
} from './install-mode.js';
import { runNotionValidation, type NotionDiagnostic } from '../notion/diagnostics.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export type CheckLevel = 'pass' | 'warn' | 'fail';

export type DoctorCheck = {
  name: string;
  level: CheckLevel;
  detail?: string;
  action?: string;
  code?: string;
};

type NotionApiLike = {
  users: {
    me: () => Promise<unknown>;
  };
  databases: {
    retrieve: (payload: { database_id: string }) => Promise<unknown>;
  };
};

interface DoctorOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  globalConfigPath?: string;
  globalOpenCodeConfigPath?: string;
  installMode?: InstallMode;
  notionFactory?: (apiKey: string) => NotionApiLike;
}

interface ParsedGlobalConfig {
  notionApiKey?: string;
  notionSessionsDbId?: string;
  notionIdeasDbId?: string;
}

type OpenCodeEntryResult = {
  found: boolean;
  location: string;
  command?: unknown;
};

function readGlobalConfig(globalConfigPath: string): ParsedGlobalConfig {
  if (!existsSync(globalConfigPath)) {
    return {};
  }

  try {
    const raw = readFileSync(globalConfigPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return globalConfigSchema.parse(parsed);
  } catch {
    return {};
  }
}

function trimOrUndefined(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getGlobalOpenCodeConfigPath(): string {
  return join(homedir(), '.config', 'opencode', 'opencode.json');
}

function readSessionVaultEntry(filePath: string): OpenCodeEntryResult {
  if (!existsSync(filePath)) {
    return { found: false, location: filePath };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mcp = parsed.mcp as Record<string, unknown> | undefined;
    const entry = mcp?.['session-vault'];
    const command =
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry as { command?: unknown }).command
        : undefined;
    return { found: Boolean(entry), location: filePath, command };
  } catch {
    return { found: false, location: filePath };
  }
}

function resolveOpenCodeEntry(cwd: string, globalOpenCodeConfigPath?: string): OpenCodeEntryResult {
  const projectPath = join(cwd, 'opencode.json');
  const globalPath = globalOpenCodeConfigPath ?? getGlobalOpenCodeConfigPath();

  const globalEntry = readSessionVaultEntry(globalPath);
  if (globalEntry.found) {
    return globalEntry;
  }

  const projectEntry = readSessionVaultEntry(projectPath);
  if (projectEntry.found) {
    return projectEntry;
  }

  return { found: false, location: existsSync(globalPath) ? globalPath : projectPath };
}

function printCheck(result: DoctorCheck): void {
  const symbol =
    result.level === 'pass' ? `${GREEN}✓${RESET}` : result.level === 'warn' ? `${YELLOW}!${RESET}` : `${RED}✗${RESET}`;
  const detail = result.detail ? ` (${result.detail})` : '';
  const action = result.action ? `\n    ↳ ${result.action}` : '';
  console.log(`${symbol} ${result.name}${detail}${action}`);
}

function makeNotionClient(apiKey: string): NotionApiLike {
  return new Client({ auth: apiKey }) as unknown as NotionApiLike;
}

function diagnosticToCheck(name: string, diagnostic: NotionDiagnostic): DoctorCheck {
  return {
    name,
    level: 'fail',
    code: diagnostic.code,
    detail: diagnostic.detail,
    action: diagnostic.troubleshooting.join(' | '),
  };
}

function formatModeLabel(mode: InstallMode | ParsedMcpCommandMode): string {
  return mode === 'global' ? 'global/direct-binary' : mode;
}

export async function runDoctorChecks(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const globalConfigPath = options.globalConfigPath ?? DEFAULT_GLOBAL_CONFIG_PATH;
  const notionFactory = options.notionFactory ?? makeNotionClient;
  const installMode = options.installMode ?? detectInstallModeFromArgv(process.argv);
  const globalOpenCodeConfigPath = options.globalOpenCodeConfigPath;

  const checks: DoctorCheck[] = [];
  const globalExists = existsSync(globalConfigPath);
  checks.push({
    name: 'Global config file exists',
    level: globalExists ? 'pass' : 'fail',
    detail: globalConfigPath,
    code: globalExists ? 'config.global.exists' : 'config.global.missing',
    action: globalExists ? undefined : 'Run session-vault init to create global configuration.',
  });

  const globalConfig = readGlobalConfig(globalConfigPath);
  const apiKey = trimOrUndefined(env.NOTION_API_KEY) ?? trimOrUndefined(globalConfig.notionApiKey);
  const sessionsDbId =
    trimOrUndefined(env.NOTION_SESSIONS_DB_ID) ?? trimOrUndefined(globalConfig.notionSessionsDbId);
  const ideasDbId = trimOrUndefined(env.NOTION_IDEAS_DB_ID) ?? trimOrUndefined(globalConfig.notionIdeasDbId);

  const apiValidation = await runNotionValidation({
    target: 'api-key',
    requiredValue: apiKey,
    operation: async () => {
      const notion = notionFactory(apiKey as string);
      await notion.users.me();
    },
  });

  if (!apiValidation.ok) {
    checks.push(diagnosticToCheck('Notion API key validation', apiValidation.diagnostic));
  } else {
    checks.push({
      name: 'Notion API key validation',
      level: 'pass',
      code: 'notion.api_key.ok',
    });
  }

  if (!apiValidation.ok) {
    checks.push({
      name: 'Sessions database access',
      level: 'fail',
      code: sessionsDbId ? 'notion.sessions_db.skipped_api_failure' : 'notion.missing_key.NOTION_SESSIONS_DB_ID',
      action: sessionsDbId
        ? 'Resolve Notion API key validation first; session DB check is blocked.'
        : 'Set NOTION_SESSIONS_DB_ID and re-run session-vault doctor.',
    });
    checks.push({
      name: 'Ideas database access',
      level: 'fail',
      code: ideasDbId ? 'notion.ideas_db.skipped_api_failure' : 'notion.missing_key.NOTION_IDEAS_DB_ID',
      action: ideasDbId
        ? 'Resolve Notion API key validation first; ideas DB check is blocked.'
        : 'Set NOTION_IDEAS_DB_ID and re-run session-vault doctor.',
    });
  } else {
    const notion = notionFactory(apiKey as string);

    const sessionsValidation = await runNotionValidation({
      target: 'sessions-db',
      requiredValue: sessionsDbId,
      operation: () => notion.databases.retrieve({ database_id: sessionsDbId as string }),
    });
    if (!sessionsValidation.ok) {
      checks.push(diagnosticToCheck('Sessions database access', sessionsValidation.diagnostic));
    } else {
      checks.push({
        name: 'Sessions database access',
        level: 'pass',
        code: 'notion.sessions_db.ok',
      });
    }

    const ideasValidation = await runNotionValidation({
      target: 'ideas-db',
      requiredValue: ideasDbId,
      operation: () => notion.databases.retrieve({ database_id: ideasDbId as string }),
    });
    if (!ideasValidation.ok) {
      checks.push(diagnosticToCheck('Ideas database access', ideasValidation.diagnostic));
    } else {
      checks.push({
        name: 'Ideas database access',
        level: 'pass',
        code: 'notion.ideas_db.ok',
      });
    }
  }

  const opencodeEntry = resolveOpenCodeEntry(cwd, globalOpenCodeConfigPath);
  if (!opencodeEntry.found) {
    checks.push({
      name: 'OpenCode MCP command shape',
      level: 'fail',
      code: 'mcp.entry.missing',
      detail: opencodeEntry.location,
      action: 'Run session-vault init and enable OpenCode integration.',
    });
    return checks;
  }

  const shapeValidation = validateMcpCommandShape(installMode, opencodeEntry.command);
  if (shapeValidation.level === 'pass') {
    checks.push({
      name: 'OpenCode MCP command shape',
      level: 'pass',
      code: shapeValidation.code,
      detail: opencodeEntry.location,
    });
  } else if (shapeValidation.level === 'warn') {
    checks.push({
      name: 'OpenCode MCP command shape',
      level: 'warn',
      code: shapeValidation.code,
      detail: `Expected ${formatModeLabel(shapeValidation.expectedMode)}, got ${formatModeLabel(shapeValidation.actualMode)}`,
      action: `Update mcp.session-vault.command in ${opencodeEntry.location} to match your install mode.`,
    });
  } else {
    checks.push({
      name: 'OpenCode MCP command shape',
      level: 'fail',
      code: shapeValidation.code,
      detail: opencodeEntry.location,
      action: 'Use ["session-vault-serve"] for global/source or ["npx","-y","session-vault-serve"] for npx.',
    });
  }

  return checks;
}

export async function runDoctorCommand(options: DoctorOptions = {}): Promise<boolean> {
  const checks = await runDoctorChecks(options);
  checks.forEach(printCheck);

  const passed = checks.filter((check) => check.level === 'pass').length;
  const warned = checks.filter((check) => check.level === 'warn').length;
  const failed = checks.filter((check) => check.level === 'fail').length;

  console.log(`\nDoctor summary: ${passed} passed, ${warned} warnings, ${failed} failed.`);

  return failed === 0;
}
