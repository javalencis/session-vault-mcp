import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function getReadme(): string {
  return readFileSync(join(process.cwd(), 'README.md'), 'utf-8');
}

describe('README installation guidance', () => {
  it('keeps Install and Configure as distinct sections', () => {
    const readme = getReadme();
    const installIndex = readme.indexOf('## Install');
    const configureIndex = readme.indexOf('## Configure');

    expect(installIndex).toBeGreaterThanOrEqual(0);
    expect(configureIndex).toBeGreaterThanOrEqual(0);
    expect(configureIndex).toBeGreaterThan(installIndex);
  });

  it('documents mode-aware configure commands and doctor troubleshooting entry point', () => {
    const readme = getReadme();
    const configureSection = readme.split('## Configure')[1] ?? '';

    expect(configureSection).toContain('session-vault init');
    expect(configureSection).toContain('session-vault doctor');
    expect(configureSection).toContain('npx session-vault init');
    expect(configureSection).toContain('npx session-vault doctor');
    expect(readme).toContain('After fixing the issue, run `session-vault doctor`.');
  });
});
