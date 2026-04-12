import { describe, expect, it } from 'vitest';

import {
  detectInstallModeFromArgv,
  expectedMcpCommandForMode,
  parseMcpCommandShape,
  validateMcpCommandShape,
} from '../../src/cli/install-mode.js';

describe('install-mode helpers', () => {
  it('detects global, npx, and source execution modes from argv', () => {
    expect(detectInstallModeFromArgv(['/usr/local/bin/session-vault'])).toBe('global');

    expect(detectInstallModeFromArgv(['/usr/local/bin/npx', 'session-vault', 'doctor'])).toBe('npx');

    expect(detectInstallModeFromArgv(['/work/session-vault/dist/cli.js', 'doctor'])).toBe('source');
  });

  it('returns expected MCP command arrays for global and npx modes', () => {
    expect(expectedMcpCommandForMode('global')).toEqual(['session-vault-serve']);
    expect(expectedMcpCommandForMode('npx')).toEqual(['npx', '-y', 'session-vault-serve']);
    expect(expectedMcpCommandForMode('source')).toEqual(['session-vault-serve']);
  });

  it('parses known MCP command shapes and flags unknown values', () => {
    expect(parseMcpCommandShape(['session-vault-serve'])).toBe('global');
    expect(parseMcpCommandShape(['npx', '-y', 'session-vault-serve'])).toBe('npx');
    expect(parseMcpCommandShape(['node', 'dist/serve.js'])).toBe('source');
    expect(parseMcpCommandShape(['foo', 'bar'])).toBe('unknown');
  });

  it('marks matching shape as pass, mismatch as warn, and invalid shape as fail', () => {
    expect(validateMcpCommandShape('global', ['session-vault-serve'])).toMatchObject({
      level: 'pass',
      code: 'mcp.command.ok',
    });

    expect(validateMcpCommandShape('global', ['npx', '-y', 'session-vault-serve'])).toMatchObject({
      level: 'warn',
      code: 'mcp.command.mismatch',
    });

    expect(validateMcpCommandShape('global', ['foo'])).toMatchObject({
      level: 'fail',
      code: 'mcp.command.invalid_shape',
    });

    expect(validateMcpCommandShape('source', ['session-vault-serve'])).toMatchObject({
      level: 'pass',
      code: 'mcp.command.ok',
    });
  });
});
