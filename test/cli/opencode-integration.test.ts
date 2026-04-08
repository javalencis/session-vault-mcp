import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const confirmMock = vi.fn();

vi.mock('@inquirer/prompts', () => ({
  confirm: confirmMock,
}));

describe('patchOpenCodeConfig', () => {
  const dirs: string[] = [];

  beforeEach(() => {
    confirmMock.mockReset();
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

  it('preserves existing fields and other mcp entries', async () => {
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

  it('does not create config when user declines', async () => {
    const { patchOpenCodeConfig } = await import('../../src/cli/opencode-integration.js');
    const projectPath = mkdtempSync(join(tmpdir(), 'session-vault-opencode-'));
    dirs.push(projectPath);
    confirmMock.mockResolvedValue(false);

    await patchOpenCodeConfig(projectPath);

    expect(() => readFileSync(join(projectPath, 'opencode.json'), 'utf-8')).toThrow();
  });
});
