import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Config } from '../types.js';
import { configSchema, globalConfigSchema } from './schema.js';

export const DEFAULT_GLOBAL_CONFIG_PATH = join(
  homedir(),
  '.config',
  'session-vault',
  'config.json',
);

const DEFAULTS: Omit<Config, 'notionApiKey'> = {
  notionSessionsDbId: undefined,
  notionIdeasDbId: undefined,
  notionParentPageId: undefined,
};

function readGlobalConfigSync(path: string): Partial<Config> {
  if (!existsSync(path)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  return globalConfigSchema.parse(parsed);
}

function pickNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

export function loadConfig(globalConfigPath: string = DEFAULT_GLOBAL_CONFIG_PATH): Config {
  const globalConfig = readGlobalConfigSync(globalConfigPath);
  const merged = {
    notionApiKey: pickNonEmpty(process.env.NOTION_API_KEY, globalConfig.notionApiKey),
    notionSessionsDbId: pickNonEmpty(
      process.env.NOTION_SESSIONS_DB_ID,
      globalConfig.notionSessionsDbId,
      DEFAULTS.notionSessionsDbId,
    ),
    notionIdeasDbId: pickNonEmpty(
      process.env.NOTION_IDEAS_DB_ID,
      globalConfig.notionIdeasDbId,
      DEFAULTS.notionIdeasDbId,
    ),
    notionParentPageId: pickNonEmpty(
      process.env.NOTION_PARENT_PAGE_ID,
      globalConfig.notionParentPageId,
      DEFAULTS.notionParentPageId,
    ),
  };

  return configSchema.parse(merged);
}
