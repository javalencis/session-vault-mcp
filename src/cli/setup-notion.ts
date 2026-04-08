import { input } from '@inquirer/prompts';
import { Client } from '@notionhq/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { DEFAULT_GLOBAL_CONFIG_PATH, loadConfig } from '../config/load.js';
import { SESSION_SOURCE_OPTIONS, ideasDatabaseSchema, sessionsDatabaseSchema } from '../notion/schemas.js';
import type { Config } from '../types.js';

type NotionDatabasesApi = {
  create: (payload: Record<string, unknown>) => Promise<{ id: string }>;
};

type NotionLike = {
  databases: NotionDatabasesApi;
};

export interface SetupNotionResult {
  sessionsDatabaseId: string;
  ideasDatabaseId: string;
}

interface SetupNotionOptions {
  parentPageId?: string;
  apiKey?: string;
  notionClient?: NotionLike;
  globalConfigPath?: string;
  loadedConfig?: Config;
}

function buildSessionProperties(): Record<string, unknown> {
  return {
    [sessionsDatabaseSchema.title.name]: { title: {} },
    [sessionsDatabaseSchema.sessionKey.name]: { rich_text: {} },
    [sessionsDatabaseSchema.goal.name]: { rich_text: {} },
    [sessionsDatabaseSchema.summary.name]: { rich_text: {} },
    [sessionsDatabaseSchema.decisions.name]: { rich_text: {} },
    [sessionsDatabaseSchema.nextSteps.name]: { rich_text: {} },
    [sessionsDatabaseSchema.tags.name]: { multi_select: {} },
    [sessionsDatabaseSchema.project.name]: { rich_text: {} },
    [sessionsDatabaseSchema.source.name]: {
      select: {
        options: SESSION_SOURCE_OPTIONS.map((name) => ({ name })),
      },
    },
  };
}

function buildIdeaProperties(sessionsDatabaseId: string): Record<string, unknown> {
  return {
    [ideasDatabaseSchema.title.name]: { title: {} },
    [ideasDatabaseSchema.description.name]: { rich_text: {} },
    [ideasDatabaseSchema.tags.name]: { multi_select: {} },
    [ideasDatabaseSchema.project.name]: { rich_text: {} },
    [ideasDatabaseSchema.sessionRelation.name]: {
      relation: {
        database_id: sessionsDatabaseId,
      },
    },
  };
}

async function resolveParentPageId(value?: string): Promise<string> {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return input({
    message: 'Enter the Notion parent page ID for new databases:',
    validate: (raw) => (raw.trim().length > 0 ? true : 'Parent page ID is required.'),
  });
}

function resolveNotionClient(apiKey: string, notionClient?: NotionLike): NotionLike {
  if (notionClient) {
    return notionClient;
  }

  return new Client({ auth: apiKey }) as unknown as NotionLike;
}

function persistGlobalConfig(config: Config, globalConfigPath: string): void {
  mkdirSync(dirname(globalConfigPath), { recursive: true });
  writeFileSync(globalConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

export async function setupNotionDatabases(options: SetupNotionOptions = {}): Promise<SetupNotionResult> {
  let loadedConfig = options.loadedConfig;
  let configParentPageId: string | undefined;
  let configApiKey: string | undefined;
  const globalConfigPath = options.globalConfigPath ?? DEFAULT_GLOBAL_CONFIG_PATH;

  try {
    loadedConfig = loadedConfig ?? loadConfig(globalConfigPath);
    configApiKey = loadedConfig.notionApiKey;
    configParentPageId = loadedConfig.notionParentPageId;
  } catch {
    // Allow setup from explicit options during init before config exists.
  }

  const apiKey = options.apiKey ?? configApiKey;

  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required to create Notion databases.');
  }

  const parentPageId = await resolveParentPageId(options.parentPageId ?? configParentPageId);
  const notion = resolveNotionClient(apiKey, options.notionClient);

  const sessionsDatabase = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Sessions' } }],
    properties: buildSessionProperties(),
  });

  const ideasDatabase = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Ideas' } }],
    properties: buildIdeaProperties(sessionsDatabase.id),
  });

  const configToPersist: Config = {
    notionApiKey: apiKey,
    notionSessionsDbId: sessionsDatabase.id,
    notionIdeasDbId: ideasDatabase.id,
    notionParentPageId: parentPageId,
  };

  persistGlobalConfig(configToPersist, globalConfigPath);

  if (loadedConfig) {
    loadedConfig.notionSessionsDbId = sessionsDatabase.id;
    loadedConfig.notionIdeasDbId = ideasDatabase.id;
    loadedConfig.notionParentPageId = parentPageId;
  }

  return {
    sessionsDatabaseId: sessionsDatabase.id,
    ideasDatabaseId: ideasDatabase.id,
  };
}

export async function runSetupNotionCommand(parentPageId?: string): Promise<SetupNotionResult> {
  const result = await setupNotionDatabases({ parentPageId });

  console.log('✅ Notion databases created successfully.');
  console.log(`   Sessions DB ID: ${result.sessionsDatabaseId}`);
  console.log(`   Ideas DB ID:    ${result.ideasDatabaseId}`);

  return result;
}
