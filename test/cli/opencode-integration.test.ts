import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const confirmMock = vi.fn();
const selectMock = vi.fn();

vi.mock('@inquirer/prompts', () => ({
  confirm: confirmMock,
  select: selectMock,
}));

// Mock homedir so the function looks for global config in a temp dir, not the real user home
const fakeHome = mkdtempSync(join(tmpdir(), 'session-vault-home-'));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => fakeHome,
  };
});

describe('patchOpenCodeConfig', () => {
  const dirs: string[] = [];

  beforeEach(() => {
    confirmMock.mockReset();
    selectMock.mockReset();
  });

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates opencode.json when missing and user accepts', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(true);

    await patchOpenCodeConfig(projectPath);

    const parsed = JSON.parse(readFileSync(join(projectPath, 'opencode.json'), 'utf-8')) as Record<
      string,
      any
    >;

    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'session-vault-serve'],
      enabled: true,
    });
  });

  it('preserves existing fields and other mcp entries in project config', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);

    writeFileSync(
      join(projectPath, 'opencode.json'),
      JSON.stringify(
        {
          theme: 'dark',
          mcp: {
            existing: {
              type: 'local',
              command: ['node', 'existing.js'],
              enabled: false,
            },
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    await patchOpenCodeConfig(projectPath);

    const parsed = JSON.parse(readFileSync(join(projectPath, 'opencode.json'), 'utf-8')) as Record<
      string,
      any
    >;

    expect(parsed.theme).toBe('dark');
    expect(parsed.mcp.existing).toEqual({
      type: 'local',
      command: ['node', 'existing.js'],
      enabled: false,
    });
    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'session-vault-serve'],
      enabled: true,
    });
  });

  it('uses global config when it exists and no project config', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);

    // Create global opencode config
    const globalDir = join(fakeHome, '.config', 'opencode');
    mkdirSync(globalDir, { recursive: true });
    const globalPath = join(globalDir, 'opencode.json');
    writeFileSync(
      globalPath,
      JSON.stringify({ mcp: { other: { type: 'local', command: ['test'], enabled: true } } }, null, 2),
      'utf-8',
    );

    await patchOpenCodeConfig(projectPath);

    const parsed = JSON.parse(readFileSync(globalPath, 'utf-8')) as Record<string, any>;

    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'session-vault-serve'],
      enabled: true,
    });
    // Other entries preserved
    expect(parsed.mcp.other).toBeDefined();

    // Cleanup
    rmSync(globalDir, { recursive: true, force: true });
  });

  it('does not create config when user declines', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(false);

    await patchOpenCodeConfig(projectPath);

    expect(() => readFileSync(join(projectPath, 'opencode.json'), 'utf-8')).toThrow();
  });
});
