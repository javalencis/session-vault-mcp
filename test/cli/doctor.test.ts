import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runDoctorChecks } from '../../src/cli/doctor.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'session-vault-doctor-'));
}

describe('runDoctorChecks', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes all checks when config, Notion, DBs, and OpenCode are valid', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = join(cwd, 'global', 'config.json');
    mkdirSync(join(cwd, 'global'), { recursive: true });
    writeFileSync(
      globalConfigPath,
      JSON.stringify(
        {
          notionApiKey: 'global-key',
          notionSessionsDbId: 'sessions-db',
          notionIdeasDbId: 'ideas-db',
        },
        null,
        2,
      ),
      'utf-8',
    );

    writeFileSync(
      join(cwd, 'opencode.json'),
      JSON.stringify(
        {
          mcp: {
            'session-vault': {
              type: 'local',
              command: ['npx', '-y', 'session-vault-serve'],
              enabled: true,
            },
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const usersMe = vi.fn().mockResolvedValue({});
    const dbRetrieve = vi.fn().mockResolvedValue({});

    const checks = await runDoctorChecks({
      cwd,
      env: {},
      globalConfigPath,
      notionFactory: () => ({
        users: { me: usersMe },
        databases: { retrieve: dbRetrieve },
      }),
    });

    expect(checks).toHaveLength(8);
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(usersMe).toHaveBeenCalledOnce();
    expect(dbRetrieve).toHaveBeenCalledTimes(2);
  });

  it('fails checks when key and db IDs are missing', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = join(cwd, 'global', 'config.json');

    const checks = await runDoctorChecks({
      cwd,
      env: {},
      globalConfigPath,
    });

    const failed = checks.filter((check) => !check.ok);
    expect(failed.length).toBeGreaterThan(0);
    expect(checks.find((check) => check.name.includes('NOTION_API_KEY'))?.ok).toBe(false);
    expect(checks.find((check) => check.name.includes('Sessions database ID'))?.ok).toBe(false);
    expect(checks.find((check) => check.name.includes('Ideas database ID'))?.ok).toBe(false);
  });
});
