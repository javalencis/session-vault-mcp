import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  readFile: readFileMock,
}));

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    accessMock.mockReset();
    readFileMock.mockReset();
  });

  it('prioritizes env vars over global config values', async () => {
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(
      JSON.stringify({
        notionApiKey: 'global-key',
        notionSessionsDbId: 'global-sessions',
      }),
    );

    const { loadConfig } = await import('./loader.js');
    const config = await loadConfig({
      env: {
        NOTION_API_KEY: 'env-key',
        NOTION_SESSIONS_DB_ID: 'env-sessions',
      },
      globalConfigPath: '/mock/global/config.json',
    });

    expect(config.notionApiKey).toBe('env-key');
    expect(config.notionSessionsDbId).toBe('env-sessions');
  });

  it('falls back to global config when env vars are missing', async () => {
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(
      JSON.stringify({
        notionApiKey: 'global-key',
        notionIdeasDbId: 'global-ideas',
        notionParentPageId: 'global-parent',
      }),
    );

    const { loadConfig } = await import('./loader.js');
    const config = await loadConfig({
      env: {},
      globalConfigPath: '/mock/global/config.json',
    });

    expect(config).toEqual({
      notionApiKey: 'global-key',
      notionSessionsDbId: undefined,
      notionIdeasDbId: 'global-ideas',
      notionParentPageId: 'global-parent',
    });
  });

  it('uses defaults for non-sensitive fields when unset', async () => {
    accessMock.mockRejectedValue(new Error('not found'));

    const { loadConfig } = await import('./loader.js');
    const config = await loadConfig({
      env: { NOTION_API_KEY: 'env-key' },
      globalConfigPath: '/mock/global/config.json',
    });

    expect(config).toEqual({
      notionApiKey: 'env-key',
      notionSessionsDbId: undefined,
      notionIdeasDbId: undefined,
      notionParentPageId: undefined,
    });
  });

  it('throws zod validation errors when NOTION_API_KEY is missing', async () => {
    accessMock.mockRejectedValue(new Error('not found'));

    const { loadConfig } = await import('./loader.js');

    await expect(
      loadConfig({ env: {}, globalConfigPath: '/mock/global/config.json' }),
    ).rejects.toMatchObject({
      name: 'ZodError',
    });
  });

  it('reads only global config and does not check project-level config', async () => {
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(JSON.stringify({ notionApiKey: 'global-key' }));

    const { loadConfig } = await import('./loader.js');
    const globalPath = '/mock/global/config.json';

    await loadConfig({ env: {}, globalConfigPath: globalPath });

    expect(accessMock).toHaveBeenCalledTimes(1);
    expect(accessMock).toHaveBeenCalledWith(globalPath, expect.any(Number));
    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledWith(globalPath, 'utf-8');
  });
});
