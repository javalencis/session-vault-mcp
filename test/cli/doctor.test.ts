import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runDoctorChecks } from '../../src/cli/doctor.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'session-vault-doctor-'));
}

function writeGlobalConfig(
  rootDir: string,
  value: { notionApiKey?: string; notionSessionsDbId?: string; notionIdeasDbId?: string },
): string {
  const globalConfigPath = join(rootDir, 'global', 'config.json');
  mkdirSync(join(rootDir, 'global'), { recursive: true });
  writeFileSync(globalConfigPath, JSON.stringify(value, null, 2), 'utf-8');
  return globalConfigPath;
}

function writeOpenCodeConfig(rootDir: string, command: unknown): void {
  writeFileSync(
    join(rootDir, 'opencode.json'),
    JSON.stringify(
      {
        mcp: {
          'session-vault': {
            type: 'local',
            command,
            enabled: true,
          },
        },
      },
      null,
      2,
    ),
    'utf-8',
  );
}

describe('runDoctorChecks', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports MCP command check as pass when shape matches install mode', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = writeGlobalConfig(cwd, {
      notionApiKey: 'global-key',
      notionSessionsDbId: 'sessions-db',
      notionIdeasDbId: 'ideas-db',
    });
    writeOpenCodeConfig(cwd, ['session-vault-serve']);

    const checks = await runDoctorChecks({
      cwd,
      env: {},
      globalConfigPath,
      globalOpenCodeConfigPath: join(cwd, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory: () => ({
        users: { me: vi.fn().mockResolvedValue({}) },
        databases: { retrieve: vi.fn().mockResolvedValue({}) },
      }),
    });

    expect(checks.find((c) => c.name === 'OpenCode MCP command shape')?.level).toBe('pass');
    expect(checks.find((c) => c.name === 'OpenCode MCP command shape')?.code).toBe('mcp.command.ok');
  });

  it('accepts direct-binary MCP shape for source install mode', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = writeGlobalConfig(cwd, {
      notionApiKey: 'global-key',
      notionSessionsDbId: 'sessions-db',
      notionIdeasDbId: 'ideas-db',
    });
    writeOpenCodeConfig(cwd, ['session-vault-serve']);

    const checks = await runDoctorChecks({
      cwd,
      env: {},
      globalConfigPath,
      globalOpenCodeConfigPath: join(cwd, 'missing-global-opencode.json'),
      installMode: 'source',
      notionFactory: () => ({
        users: { me: vi.fn().mockResolvedValue({}) },
        databases: { retrieve: vi.fn().mockResolvedValue({}) },
      }),
    });

    const mcpCheck = checks.find((c) => c.name === 'OpenCode MCP command shape');
    expect(mcpCheck?.level).toBe('pass');
    expect(mcpCheck?.code).toBe('mcp.command.ok');
  });

  it('reports MCP mismatch as warn and invalid shape as fail', async () => {
    const cwdWarn = makeTempDir();
    const cwdFail = makeTempDir();
    createdDirs.push(cwdWarn, cwdFail);

    const globalWarn = writeGlobalConfig(cwdWarn, { notionApiKey: 'k', notionSessionsDbId: 's', notionIdeasDbId: 'i' });
    const globalFail = writeGlobalConfig(cwdFail, { notionApiKey: 'k', notionSessionsDbId: 's', notionIdeasDbId: 'i' });
    writeOpenCodeConfig(cwdWarn, ['npx', '-y', 'session-vault-serve']);
    writeOpenCodeConfig(cwdFail, ['foo']);

    const notionFactory = () => ({
      users: { me: vi.fn().mockResolvedValue({}) },
      databases: { retrieve: vi.fn().mockResolvedValue({}) },
    });

    const warnChecks = await runDoctorChecks({
      cwd: cwdWarn,
      env: {},
      globalConfigPath: globalWarn,
      globalOpenCodeConfigPath: join(cwdWarn, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory,
    });

    const failChecks = await runDoctorChecks({
      cwd: cwdFail,
      env: {},
      globalConfigPath: globalFail,
      globalOpenCodeConfigPath: join(cwdFail, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory,
    });

    expect(warnChecks.find((c) => c.name === 'OpenCode MCP command shape')?.level).toBe('warn');
    expect(warnChecks.find((c) => c.name === 'OpenCode MCP command shape')?.code).toBe('mcp.command.mismatch');
    expect(failChecks.find((c) => c.name === 'OpenCode MCP command shape')?.level).toBe('fail');
    expect(failChecks.find((c) => c.name === 'OpenCode MCP command shape')?.code).toBe('mcp.command.invalid_shape');
  });

  it('short-circuits network checks when NOTION_API_KEY is missing', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = writeGlobalConfig(cwd, {
      notionSessionsDbId: 'sessions-db',
      notionIdeasDbId: 'ideas-db',
    });
    writeOpenCodeConfig(cwd, ['session-vault-serve']);

    const usersMe = vi.fn().mockResolvedValue({});
    const dbRetrieve = vi.fn().mockResolvedValue({});

    const checks = await runDoctorChecks({
      cwd,
      env: {},
      globalConfigPath,
      globalOpenCodeConfigPath: join(cwd, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory: () => ({
        users: { me: usersMe },
        databases: { retrieve: dbRetrieve },
      }),
    });

    expect(checks.find((c) => c.name === 'Notion API key validation')?.code).toBe('notion.missing_key.NOTION_API_KEY');
    expect(checks.find((c) => c.name === 'Notion API key validation')?.action).toContain('Set NOTION_API_KEY');
    expect(usersMe).not.toHaveBeenCalled();
    expect(dbRetrieve).not.toHaveBeenCalled();
  });

  it('prints explicit missing-key guidance for sessions and ideas IDs', async () => {
    const cwd = makeTempDir();
    createdDirs.push(cwd);

    const globalConfigPath = writeGlobalConfig(cwd, {
      notionApiKey: 'global-key',
    });
    writeOpenCodeConfig(cwd, ['session-vault-serve']);

    const dbRetrieve = vi.fn().mockResolvedValue({});

    const checks = await runDoctorChecks({
      cwd,
      env: { NOTION_API_KEY: 'env-key' },
      globalConfigPath,
      globalOpenCodeConfigPath: join(cwd, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory: () => ({
        users: { me: vi.fn().mockResolvedValue({}) },
        databases: { retrieve: dbRetrieve },
      }),
    });

    const sessionsCheck = checks.find((c) => c.name === 'Sessions database access');
    const ideasCheck = checks.find((c) => c.name === 'Ideas database access');

    expect(sessionsCheck?.code).toBe('notion.missing_key.NOTION_SESSIONS_DB_ID');
    expect(sessionsCheck?.action).toContain('Set NOTION_SESSIONS_DB_ID');
    expect(ideasCheck?.code).toBe('notion.missing_key.NOTION_IDEAS_DB_ID');
    expect(ideasCheck?.action).toContain('Set NOTION_IDEAS_DB_ID');
    expect(dbRetrieve).not.toHaveBeenCalled();
  });

  it('classifies auth and transport failures with deterministic doctor guidance', async () => {
    const cwdAuth = makeTempDir();
    const cwdTransport = makeTempDir();
    createdDirs.push(cwdAuth, cwdTransport);

    const globalAuth = writeGlobalConfig(cwdAuth, {
      notionApiKey: 'k',
      notionSessionsDbId: 'sessions-db',
      notionIdeasDbId: 'ideas-db',
    });
    const globalTransport = writeGlobalConfig(cwdTransport, {
      notionApiKey: 'k',
      notionSessionsDbId: 'sessions-db',
      notionIdeasDbId: 'ideas-db',
    });
    writeOpenCodeConfig(cwdAuth, ['session-vault-serve']);
    writeOpenCodeConfig(cwdTransport, ['session-vault-serve']);

    const authChecks = await runDoctorChecks({
      cwd: cwdAuth,
      env: {},
      globalConfigPath: globalAuth,
      globalOpenCodeConfigPath: join(cwdAuth, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory: () => ({
        users: {
          me: async () => {
            throw Object.assign(new Error('Unauthorized'), { status: 401, code: 'unauthorized' });
          },
        },
        databases: { retrieve: vi.fn().mockResolvedValue({}) },
      }),
    });

    const transportChecks = await runDoctorChecks({
      cwd: cwdTransport,
      env: {},
      globalConfigPath: globalTransport,
      globalOpenCodeConfigPath: join(cwdTransport, 'missing-global-opencode.json'),
      installMode: 'global',
      notionFactory: () => ({
        users: {
          me: async () => {
            throw new Error('fetch failed');
          },
        },
        databases: { retrieve: vi.fn().mockResolvedValue({}) },
      }),
    });

    const authApiCheck = authChecks.find((c) => c.name === 'Notion API key validation');
    expect(authApiCheck?.level).toBe('fail');
    expect(authApiCheck?.code).toBe('notion.auth_permission.unauthorized');

    const transportApiCheck = transportChecks.find((c) => c.name === 'Notion API key validation');
    expect(transportApiCheck?.level).toBe('fail');
    expect(transportApiCheck?.code).toBe('notion.transport.fetch_failed');
    expect(transportApiCheck?.action).toContain('Node <22.21.0');
    expect(transportApiCheck?.action).toContain('TLS/VPN interception');
  });
});
