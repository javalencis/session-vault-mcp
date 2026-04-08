import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';

import type { Config } from '../types.js';
import { configSchema, globalConfigSchema } from './schema.js';

export const DEFAULT_GLOBAL_CONFIG_PATH = join(
  homedir(),
  '.config',
  'session-vault',
  'config.json',
);

interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv;
  globalConfigPath?: string;
}

const DEFAULTS: Omit<Config, 'notionApiKey'> = {
  notionSessionsDbId: undefined,
  notionIdeasDbId: undefined,
  notionParentPageId: undefined,
};

async function readGlobalConfig(path: string): Promise<Partial<Config>> {
  try {
    await access(path, fsConstants.F_OK);
  } catch {
    return {};
  }

  const content = await readFile(path, 'utf-8');
  const parsed = JSON.parse(content) as unknown;
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

export async function loadConfig(options: LoadConfigOptions = {}): Promise<Config> {
  dotenv.config();

  const env = options.env ?? process.env;
  const globalConfigPath = options.globalConfigPath ?? DEFAULT_GLOBAL_CONFIG_PATH;
  const globalConfig = await readGlobalConfig(globalConfigPath);

  const merged = {
    notionApiKey: pickNonEmpty(env.NOTION_API_KEY, globalConfig.notionApiKey),
    notionSessionsDbId: pickNonEmpty(
      env.NOTION_SESSIONS_DB_ID,
      globalConfig.notionSessionsDbId,
      DEFAULTS.notionSessionsDbId,
    ),
    notionIdeasDbId: pickNonEmpty(
      env.NOTION_IDEAS_DB_ID,
      globalConfig.notionIdeasDbId,
      DEFAULTS.notionIdeasDbId,
    ),
    notionParentPageId: pickNonEmpty(
      env.NOTION_PARENT_PAGE_ID,
      globalConfig.notionParentPageId,
      DEFAULTS.notionParentPageId,
    ),
  };

  return configSchema.parse(merged);
}
