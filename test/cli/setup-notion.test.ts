import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupNotionDatabases } from '../../src/cli/setup-notion.js';
import type { Config } from '../../src/types.js';

describe('setupNotionDatabases', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists created database IDs to global config and updates loaded config in memory', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'session-vault-setup-notion-'));
    createdDirs.push(tempDir);
    const globalConfigPath = join(tempDir, 'config', 'config.json');

    const loadedConfig: Config = {
      notionApiKey: 'api-key',
      notionSessionsDbId: 'old-sessions',
      notionIdeasDbId: 'old-ideas',
      notionParentPageId: 'old-parent',
    };

    const notionClient = {
      databases: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'new-sessions-db' })
          .mockResolvedValueOnce({ id: 'new-ideas-db' }),
      },
    };

    const result = await setupNotionDatabases({
      apiKey: 'api-key',
      parentPageId: 'parent-page',
      notionClient,
      loadedConfig,
      globalConfigPath,
    });

    expect(result).toEqual({
      sessionsDatabaseId: 'new-sessions-db',
      ideasDatabaseId: 'new-ideas-db',
    });

    const persisted = JSON.parse(readFileSync(globalConfigPath, 'utf-8')) as Config;
    expect(persisted).toEqual({
      notionApiKey: 'api-key',
      notionSessionsDbId: 'new-sessions-db',
      notionIdeasDbId: 'new-ideas-db',
      notionParentPageId: 'parent-page',
    });

    expect(loadedConfig.notionSessionsDbId).toBe('new-sessions-db');
    expect(loadedConfig.notionIdeasDbId).toBe('new-ideas-db');
    expect(loadedConfig.notionParentPageId).toBe('parent-page');
  });
});
