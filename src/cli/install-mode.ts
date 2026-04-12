export type InstallMode = 'global' | 'npx' | 'source';

export type ParsedMcpCommandMode = InstallMode | 'unknown';

export type McpCommandValidation = {
  level: 'pass' | 'warn' | 'fail';
  code: 'mcp.command.ok' | 'mcp.command.mismatch' | 'mcp.command.invalid_shape';
  expectedMode: InstallMode;
  actualMode: ParsedMcpCommandMode;
};

const SOURCE_PATTERNS = ['dist/cli.js', 'src/cli/index.ts', 'src/cli/index.js'];

function hasSegment(value: string, segment: string): boolean {
  return value.toLowerCase().includes(segment.toLowerCase());
}

export function detectInstallModeFromArgv(argv: string[] = process.argv): InstallMode {
  const normalized = argv.map((value) => value.toLowerCase());

  if (normalized.some((value) => value.endsWith('npx') || value.includes('npx-cli.js') || value === 'npx')) {
    return 'npx';
  }

  if (normalized.some((value) => SOURCE_PATTERNS.some((pattern) => hasSegment(value, pattern)))) {
    return 'source';
  }

  return 'global';
}

export function expectedMcpCommandForMode(mode: InstallMode): string[] {
  if (mode === 'npx') {
    return ['npx', '-y', 'session-vault-serve'];
  }

  return ['session-vault-serve'];
}

export function parseMcpCommandShape(command: unknown): ParsedMcpCommandMode {
  if (!Array.isArray(command) || command.some((entry) => typeof entry !== 'string')) {
    return 'unknown';
  }

  const values = command as string[];

  if (values.length === 1 && values[0] === 'session-vault-serve') {
    return 'global';
  }

  if (values.length === 3 && values[0] === 'npx' && values[1] === '-y' && values[2] === 'session-vault-serve') {
    return 'npx';
  }

  if (values.length === 2 && values[0] === 'node' && values[1] === 'dist/serve.js') {
    return 'source';
  }

  return 'unknown';
}

export function validateMcpCommandShape(expectedMode: InstallMode, command: unknown): McpCommandValidation {
  const actualMode = parseMcpCommandShape(command);

  if (actualMode === 'unknown') {
    return {
      level: 'fail',
      code: 'mcp.command.invalid_shape',
      expectedMode,
      actualMode,
    };
  }

  const directBinaryCompatibleWithSource = expectedMode === 'source' && actualMode === 'global';

  if (actualMode !== expectedMode && !directBinaryCompatibleWithSource) {
    return {
      level: 'warn',
      code: 'mcp.command.mismatch',
      expectedMode,
      actualMode,
    };
  }

  return {
    level: 'pass',
    code: 'mcp.command.ok',
    expectedMode,
    actualMode,
  };
}
