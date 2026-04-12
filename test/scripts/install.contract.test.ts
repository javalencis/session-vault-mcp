import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'install.sh');

function resolveBashPath(): string | null {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const probe = spawnSync(locator, ['bash'], { encoding: 'utf-8' });
  if (probe.status !== 0) {
    return null;
  }

  const first = probe.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return first ?? null;
}

const BASH_PATH = resolveBashPath();

function hasBash(): boolean {
  if (!BASH_PATH) {
    return false;
  }

  const probe = spawnSync(BASH_PATH, ['--version'], { encoding: 'utf-8' });
  return probe.status === 0;
}

function writeExecutable(dir: string, name: string, body: string): void {
  const path = join(dir, name);
  writeFileSync(path, body, 'utf-8');
  chmodSync(path, 0o755);
}

function runInstaller(pathDir: string) {
  if (!BASH_PATH) {
    throw new Error('bash is not available');
  }

  return spawnSync(BASH_PATH, [SCRIPT_PATH], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${pathDir}${process.platform === 'win32' ? ';' : ':'}${dirname(BASH_PATH)}`,
      SESSION_VAULT_PACKAGE: 'session-vault',
      SESSION_VAULT_INSTALL_OS_NAME: 'Darwin',
    },
  });
}

describe('scripts/install.sh contract', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!hasBash())('reports missing dependencies with failing step diagnostics', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(
      bin,
      'uname',
      `#!/usr/bin/env bash
echo Darwin
`,
    );

    const result = runInstaller(bin);
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(combined).toContain('Failed step: dependency-check:node');
    expect(combined).toContain('Node.js is required');
  });

  it.skipIf(!hasBash())('reports missing npm dependency with failing step diagnostics', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(bin, 'uname', '#!/usr/bin/env bash\necho Darwin\n');
    writeExecutable(bin, 'node', '#!/usr/bin/env bash\necho v22.20.0\n');

    const result = runInstaller(bin);
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(combined).toContain('Failed step: dependency-check:npm');
    expect(combined).toContain('npm is required');
  });

  it.skipIf(!hasBash())('prints environment snapshot when global npm install fails', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(bin, 'uname', '#!/usr/bin/env bash\necho Darwin\n');
    writeExecutable(bin, 'node', '#!/usr/bin/env bash\nif [ "$1" = "-p" ]; then echo 22; else echo v22.20.0; fi\n');
    writeExecutable(
      bin,
      'npm',
      `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo 10.8.0
  exit 0
fi
if [ "$1" = "prefix" ] && [ "$2" = "-g" ]; then
  echo /tmp/fake-prefix
  exit 0
fi
if [ "$1" = "view" ]; then
  exit 0
fi
if [ "$1" = "install" ]; then
  echo install failed >&2
  exit 17
fi
exit 0
`,
    );

    const result = runInstaller(bin);
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(17);
    expect(combined).toContain('Failed step: npm-install-global');
    expect(combined).toContain('OS: Darwin');
    expect(combined).toContain('Shell:');
    expect(combined).toContain('Node: v22.20.0');
    expect(combined).toContain('npm: 10.8.0');
    expect(combined).toContain('npm global prefix: /tmp/fake-prefix');
  });

  it.skipIf(!hasBash())('reports PATH resolution failure with expected global bin path', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(bin, 'uname', '#!/usr/bin/env bash\necho Darwin\n');
    writeExecutable(bin, 'node', '#!/usr/bin/env bash\nif [ "$1" = "-p" ]; then echo 22; else echo v22.20.0; fi\n');
    writeExecutable(
      bin,
      'npm',
      `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo 10.8.0
  exit 0
fi
if [ "$1" = "prefix" ] && [ "$2" = "-g" ]; then
  echo /tmp/fake-prefix
  exit 0
fi
if [ "$1" = "view" ] || [ "$1" = "install" ]; then
  exit 0
fi
exit 0
`,
    );

    const result = runInstaller(bin);
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(combined).toContain('Failed step: verify-path:session-vault');
    expect(combined).toContain('/tmp/fake-prefix/bin');
  });

  it.skipIf(!hasBash())('reports PATH failure when session-vault-serve is missing', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(bin, 'uname', '#!/usr/bin/env bash\necho Darwin\n');
    writeExecutable(bin, 'node', '#!/usr/bin/env bash\nif [ "$1" = "-p" ]; then echo 22; else echo v22.20.0; fi\n');
    writeExecutable(
      bin,
      'npm',
      `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo 10.8.0
  exit 0
fi
if [ "$1" = "prefix" ] && [ "$2" = "-g" ]; then
  echo /tmp/fake-prefix
  exit 0
fi
if [ "$1" = "view" ] || [ "$1" = "install" ]; then
  exit 0
fi
exit 0
`,
    );
    writeExecutable(bin, 'session-vault', '#!/usr/bin/env bash\nexit 0\n');

    const result = runInstaller(bin);
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(combined).toContain('Failed step: verify-path:session-vault-serve');
    expect(combined).toContain('/tmp/fake-prefix/bin');
  });

  it.skipIf(!hasBash())('prints success guidance with direct-binary MCP example', () => {
    const bin = mkdtempSync(join(tmpdir(), 'session-vault-install-bin-'));
    tempDirs.push(bin);

    writeExecutable(bin, 'uname', '#!/usr/bin/env bash\necho Darwin\n');
    writeExecutable(bin, 'node', '#!/usr/bin/env bash\nif [ "$1" = "-p" ]; then echo 22; else echo v22.20.0; fi\n');
    writeExecutable(
      bin,
      'npm',
      `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo 10.8.0
  exit 0
fi
if [ "$1" = "prefix" ] && [ "$2" = "-g" ]; then
  echo /tmp/fake-prefix
  exit 0
fi
if [ "$1" = "view" ] || [ "$1" = "install" ]; then
  exit 0
fi
exit 0
`,
    );
    writeExecutable(bin, 'session-vault', '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(bin, 'session-vault-serve', '#!/usr/bin/env bash\nexit 0\n');

    const result = runInstaller(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('command": ["session-vault-serve"]');
    expect(result.stdout).toContain('session-vault doctor');
  });
});
