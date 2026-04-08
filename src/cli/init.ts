import { confirm, input, password, select } from '@inquirer/prompts';
import { Client } from '@notionhq/client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Config } from '../types.js';
import { patchOpenCodeConfig } from './opencode-integration.js';
import { setupNotionDatabases } from './setup-notion.js';

const GLOBAL_CONFIG_PATH = join(homedir(), '.config', 'session-vault', 'config.json');

type NotionUsersApi = {
  me: () => Promise<unknown>;
};

type NotionClientForInit = {
  users: NotionUsersApi;
};

function notionClientFactory(apiKey: string): NotionClientForInit {
  return new Client({ auth: apiKey }) as unknown as NotionClientForInit;
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeGlobalConfig(config: Config): void {
  ensureDir(join(homedir(), '.config', 'session-vault'));
  writeFileSync(GLOBAL_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  if (content.trim().length === 0) {
    return `${line}\n`;
  }

  return `${content.trimEnd()}\n${line}\n`;
}

function writeProjectEnv(apiKey: string): void {
  const envPath = join(process.cwd(), '.env');
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const next = upsertEnvVar(existing, 'NOTION_API_KEY', apiKey);
  writeFileSync(envPath, next, 'utf-8');
}

async function validateNotionApiKey(apiKey: string, notionFactory = notionClientFactory): Promise<void> {
  const notion = notionFactory(apiKey);
  await notion.users.me();
}

export async function runInitCommand(): Promise<void> {
  console.log('Welcome to session-vault.');
  console.log('This wizard configures Notion databases and local integration for capturing sessions.\n');

  const apiKey = await password({
    message: 'Enter your NOTION_API_KEY:',
    mask: '*',
    validate: (value) => (value.trim().length > 0 ? true : 'NOTION_API_KEY is required.'),
  });

  try {
    await validateNotionApiKey(apiKey.trim());
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Notion API error';
    throw new Error(`Unable to validate NOTION_API_KEY. Please verify integration permissions. Details: ${reason}`);
  }

  const databaseMode = await select({
    message: 'Do you want to create new databases or use existing ones?',
    choices: [
      { name: 'Create new databases', value: 'create' },
      { name: 'Use existing databases', value: 'existing' },
    ],
    default: 'create',
  });

  let notionSessionsDbId: string | undefined;
  let notionIdeasDbId: string | undefined;
  let notionParentPageId: string | undefined;

  if (databaseMode === 'create') {
    notionParentPageId = await input({
      message: 'Enter Notion parent page ID where databases should be created:',
      validate: (value) => (value.trim().length > 0 ? true : 'Parent page ID is required.'),
    });

    const created = await setupNotionDatabases({
      parentPageId: notionParentPageId,
      apiKey,
    });
    notionSessionsDbId = created.sessionsDatabaseId;
    notionIdeasDbId = created.ideasDatabaseId;
  } else {
    notionSessionsDbId = await input({
      message: 'Enter NOTION_SESSIONS_DB_ID:',
      validate: (value) => (value.trim().length > 0 ? true : 'NOTION_SESSIONS_DB_ID is required.'),
    });
    notionIdeasDbId = await input({
      message: 'Enter NOTION_IDEAS_DB_ID:',
      validate: (value) => (value.trim().length > 0 ? true : 'NOTION_IDEAS_DB_ID is required.'),
    });
  }

  const globalConfig: Config = {
    notionApiKey: apiKey,
    notionSessionsDbId,
    notionIdeasDbId,
    notionParentPageId,
  };

  writeGlobalConfig(globalConfig);
  writeProjectEnv(apiKey);

  const configureOpenCode = await confirm({
    message: 'Configure OpenCode integration?',
    default: true,
  });

  if (configureOpenCode) {
    await patchOpenCodeConfig(process.cwd());
  }

  console.log('\n✅ session-vault init complete.');
  console.log(`   Global config: ${GLOBAL_CONFIG_PATH}`);
  console.log(`   NOTION_SESSIONS_DB_ID: ${notionSessionsDbId ?? '(not set)'}`);
  console.log(`   NOTION_IDEAS_DB_ID:    ${notionIdeasDbId ?? '(not set)'}`);
  console.log(`   OpenCode integration:  ${configureOpenCode ? 'configured' : 'skipped'}`);
  console.log('\nNext step: run `session-vault doctor` to verify your setup.');
}
