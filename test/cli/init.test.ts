import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const confirmMock = vi.fn();
const inputMock = vi.fn();
const passwordMock = vi.fn();
const selectMock = vi.fn();

vi.mock('@inquirer/prompts', () => ({
  confirm: confirmMock,
  input: inputMock,
  password: passwordMock,
  select: selectMock,
}));

vi.mock('../../src/cli/opencode-integration.js', () => ({
  patchOpenCodeConfig: vi.fn(),
}));

vi.mock('../../src/cli/setup-notion.js', () => ({
  setupNotionDatabases: vi.fn(),
}));

describe('runInitCommand', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    confirmMock.mockReset();
    inputMock.mockReset();
    passwordMock.mockReset();
    selectMock.mockReset();

    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('continues setup when API key validation succeeds', async () => {
    const { runInitCommand } = await import('../../src/cli/init.js');
    const cwd = mkdtempSync(join(tmpdir(), 'session-vault-init-'));
    createdDirs.push(cwd);

    const usersMe = vi.fn().mockResolvedValue({});
    const globalConfigPath = join(cwd, 'config', 'config.json');

    passwordMock.mockResolvedValue('secret-key');
    selectMock.mockResolvedValue('existing');
    inputMock.mockResolvedValueOnce('sessions-db').mockResolvedValueOnce('ideas-db');
    confirmMock.mockResolvedValue(false);

    await runInitCommand({
      cwd,
      globalConfigPath,
      notionFactory: () => ({ users: { me: usersMe } }),
    });

    const persisted = JSON.parse(readFileSync(globalConfigPath, 'utf-8')) as Record<string, string>;
    expect(usersMe).toHaveBeenCalledOnce();
    expect(persisted.notionApiKey).toBe('secret-key');
  });

  it('aborts with missing-key diagnostics and skips network call', async () => {
    const { runInitCommand } = await import('../../src/cli/init.js');
    const usersMe = vi.fn().mockResolvedValue({});

    passwordMock.mockResolvedValue('   ');

    let thrownMessage = '';

    await expect(
      runInitCommand({
        notionFactory: () => ({ users: { me: usersMe } }),
      }),
    ).rejects.toThrowError(/notion\.missing_key\.NOTION_API_KEY/);

    try {
      await runInitCommand({
        notionFactory: () => ({ users: { me: usersMe } }),
      });
    } catch (error) {
      thrownMessage = (error as Error).message;
    }

    expect(thrownMessage).toContain('Set NOTION_API_KEY');
    expect(usersMe).not.toHaveBeenCalled();
  });

  it('aborts with auth-permission diagnostics when Notion rejects credentials', async () => {
    const { runInitCommand } = await import('../../src/cli/init.js');

    passwordMock.mockResolvedValue('secret-key');

    await expect(
      runInitCommand({
        notionFactory: () => ({
          users: {
            me: async () => {
              throw Object.assign(new Error('Unauthorized'), { status: 401, code: 'unauthorized' });
            },
          },
        }),
      }),
    ).rejects.toThrowError(/notion\.auth_permission\.unauthorized/);
  });

  it('aborts with transport diagnostics and proxy/node troubleshooting text', async () => {
    const { runInitCommand } = await import('../../src/cli/init.js');

    passwordMock.mockResolvedValue('secret-key');

    await expect(
      runInitCommand({
        notionFactory: () => ({
          users: {
            me: async () => {
              throw new Error('fetch failed');
            },
          },
        }),
      }),
    ).rejects.toThrowError(/network or transport issues/);

    await expect(
      runInitCommand({
        notionFactory: () => ({
          users: {
            me: async () => {
              throw new Error('fetch failed');
            },
          },
        }),
      }),
    ).rejects.toThrowError(/Node <22\.21\.0/);
  });
});
