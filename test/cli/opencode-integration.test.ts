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

  it('creates opencode.json with direct binary for global install mode', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(true);

    await patchOpenCodeConfig(projectPath, { installMode: 'global' });

    const parsed = JSON.parse(readFileSync(join(projectPath, 'opencode.json'), 'utf-8')) as Record<
      string,
      any
    >;

    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['session-vault-serve'],
      env: {
        NODE_USE_SYSTEM_CA: '1',
      },
      enabled: true,
    });
  });

  it('writes npx MCP command for npx install mode', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(true);

    await patchOpenCodeConfig(projectPath, { installMode: 'npx' });

    const parsed = JSON.parse(readFileSync(join(projectPath, 'opencode.json'), 'utf-8')) as Record<
      string,
      any
    >;

    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'session-vault-serve'],
      env: {
        NODE_USE_SYSTEM_CA: '1',
      },
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

    await patchOpenCodeConfig(projectPath, { installMode: 'global' });

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
      command: ['session-vault-serve'],
      env: {
        NODE_USE_SYSTEM_CA: '1',
      },
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

    await patchOpenCodeConfig(projectPath, { installMode: 'global' });

    const parsed = JSON.parse(readFileSync(globalPath, 'utf-8')) as Record<string, any>;

    expect(parsed.mcp['session-vault']).toEqual({
      type: 'local',
      command: ['session-vault-serve'],
      env: {
        NODE_USE_SYSTEM_CA: '1',
      },
      enabled: true,
    });
    // Other entries preserved
    expect(parsed.mcp.other).toBeDefined();

    // Cleanup
    rmSync(globalDir, { recursive: true, force: true });
  });

  it('keeps config-target selection explicit when both global and project exist', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);

    writeFileSync(join(projectPath, 'opencode.json'), JSON.stringify({ mcp: {} }, null, 2), 'utf-8');

    const globalDir = join(fakeHome, '.config', 'opencode');
    mkdirSync(globalDir, { recursive: true });
    const globalPath = join(globalDir, 'opencode.json');
    writeFileSync(globalPath, JSON.stringify({ mcp: {} }, null, 2), 'utf-8');

    selectMock.mockResolvedValue('project');

    await patchOpenCodeConfig(projectPath, { installMode: 'global' });

    const projectParsed = JSON.parse(readFileSync(join(projectPath, 'opencode.json'), 'utf-8')) as Record<
      string,
      any
    >;
    const globalParsed = JSON.parse(readFileSync(globalPath, 'utf-8')) as Record<string, any>;

    expect(selectMock).toHaveBeenCalledOnce();
    expect(projectParsed.mcp['session-vault'].command).toEqual(['session-vault-serve']);
    expect(globalParsed.mcp['session-vault']).toBeUndefined();

    rmSync(globalDir, { recursive: true, force: true });
  });

  it('does not create config when user declines', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(false);

    await patchOpenCodeConfig(projectPath, { installMode: 'global' });

    expect(() => readFileSync(join(projectPath, 'opencode.json'), 'utf-8')).toThrow();
  });
});
