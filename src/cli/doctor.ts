import { Client } from '@notionhq/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_GLOBAL_CONFIG_PATH } from '../config/load.js';
import { globalConfigSchema } from '../config/schema.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

type CheckStatus = {
  name: string;
  ok: boolean;
  detail?: string;
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
  notionFactory?: (apiKey: string) => NotionApiLike;
}

interface ParsedGlobalConfig {
  notionApiKey?: string;
  notionSessionsDbId?: string;
  notionIdeasDbId?: string;
}

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

function checkOpencodeEntry(cwd: string): boolean {
  const opencodePath = join(cwd, 'opencode.json');

  if (!existsSync(opencodePath)) {
    return false;
  }

  try {
    const raw = readFileSync(opencodePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mcp = parsed.mcp as Record<string, unknown> | undefined;
    return Boolean(mcp?.['session-vault']);
  } catch {
    return false;
  }
}

function printCheck(result: CheckStatus): void {
  const symbol = result.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const suffix = result.detail ? ` (${result.detail})` : '';
  console.log(`${symbol} ${result.name}${suffix}`);
}

function makeNotionClient(apiKey: string): NotionApiLike {
  return new Client({ auth: apiKey }) as unknown as NotionApiLike;
}

export async function runDoctorChecks(options: DoctorOptions = {}): Promise<CheckStatus[]> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const globalConfigPath = options.globalConfigPath ?? DEFAULT_GLOBAL_CONFIG_PATH;
  const notionFactory = options.notionFactory ?? makeNotionClient;

  const checks: CheckStatus[] = [];

  const globalExists = existsSync(globalConfigPath);
  checks.push({ name: 'Global config file exists', ok: globalExists, detail: globalConfigPath });

  const globalConfig = readGlobalConfig(globalConfigPath);
  const apiKey = trimOrUndefined(env.NOTION_API_KEY) ?? trimOrUndefined(globalConfig.notionApiKey);

  checks.push({
    name: 'NOTION_API_KEY is set (env or global config)',
    ok: Boolean(apiKey),
  });

  let notion: NotionApiLike | undefined;
  if (apiKey) {
    try {
      notion = notionFactory(apiKey);
      await notion.users.me();
      checks.push({ name: 'Notion API responds', ok: true });
    } catch (error) {
      checks.push({
        name: 'Notion API responds',
        ok: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    checks.push({ name: 'Notion API responds', ok: false, detail: 'Missing NOTION_API_KEY' });
  }

  const sessionsDbId =
    trimOrUndefined(env.NOTION_SESSIONS_DB_ID) ?? trimOrUndefined(globalConfig.notionSessionsDbId);
  checks.push({ name: 'Sessions database ID is configured', ok: Boolean(sessionsDbId) });

  if (notion && sessionsDbId) {
    try {
      await notion.databases.retrieve({ database_id: sessionsDbId });
      checks.push({ name: 'Sessions database is accessible', ok: true });
    } catch (error) {
      checks.push({
        name: 'Sessions database is accessible',
        ok: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    checks.push({ name: 'Sessions database is accessible', ok: false, detail: 'Missing API key or DB ID' });
  }

  const ideasDbId = trimOrUndefined(env.NOTION_IDEAS_DB_ID) ?? trimOrUndefined(globalConfig.notionIdeasDbId);
  checks.push({ name: 'Ideas database ID is configured', ok: Boolean(ideasDbId) });

  if (notion && ideasDbId) {
    try {
      await notion.databases.retrieve({ database_id: ideasDbId });
      checks.push({ name: 'Ideas database is accessible', ok: true });
    } catch (error) {
      checks.push({
        name: 'Ideas database is accessible',
        ok: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    checks.push({ name: 'Ideas database is accessible', ok: false, detail: 'Missing API key or DB ID' });
  }

  checks.push({
    name: 'OpenCode config has session-vault MCP entry',
    ok: checkOpencodeEntry(cwd),
    detail: join(cwd, 'opencode.json'),
  });

  return checks;
}

export async function runDoctorCommand(options: DoctorOptions = {}): Promise<boolean> {
  const checks = await runDoctorChecks(options);
  checks.forEach(printCheck);

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  console.log(`\nDoctor summary: ${passed} passed, ${failed} failed.`);

  return failed === 0;
}
