import { describe, expect, it, vi } from 'vitest';

import { runNotionValidation } from '../../src/notion/diagnostics.js';

describe('runNotionValidation', () => {
  it('short-circuits missing NOTION_API_KEY without network calls', async () => {
    const operation = vi.fn();

    const result = await runNotionValidation({
      target: 'api-key',
      requiredValue: undefined,
      operation,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.diagnostic).toMatchObject({
      category: 'missing-key',
      code: 'notion.missing_key.NOTION_API_KEY',
      summary: 'Missing required environment variable: NOTION_API_KEY.',
      troubleshooting: [
        'Set NOTION_API_KEY in your shell environment or ~/.config/session-vault/config.json.',
        'Run session-vault doctor after updating environment variables.',
      ],
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it('short-circuits missing database ids with deterministic env guidance', async () => {
    const operation = vi.fn();

    const sessionsResult = await runNotionValidation({
      target: 'sessions-db',
      requiredValue: '',
      operation,
    });

    const ideasResult = await runNotionValidation({
      target: 'ideas-db',
      requiredValue: '   ',
      operation,
    });

    expect(sessionsResult.ok).toBe(false);
    expect(ideasResult.ok).toBe(false);
    expect(sessionsResult.ok ? null : sessionsResult.diagnostic.code).toBe(
      'notion.missing_key.NOTION_SESSIONS_DB_ID',
    );
    expect(sessionsResult.ok ? null : sessionsResult.diagnostic.troubleshooting[0]).toContain('Set NOTION_SESSIONS_DB_ID');
    expect(ideasResult.ok ? null : ideasResult.diagnostic.code).toBe('notion.missing_key.NOTION_IDEAS_DB_ID');
    expect(ideasResult.ok ? null : ideasResult.diagnostic.troubleshooting[0]).toContain('Set NOTION_IDEAS_DB_ID');
    expect(operation).not.toHaveBeenCalled();
  });

  it('classifies 401/403 and permission-like api errors as auth-permission', async () => {
    const unauthorized = await runNotionValidation({
      target: 'api-key',
      requiredValue: 'secret',
      operation: async () => {
        throw Object.assign(new Error('Unauthorized'), { status: 401, code: 'unauthorized' });
      },
    });

    const restricted = await runNotionValidation({
      target: 'sessions-db',
      requiredValue: 'db-id',
      operation: async () => {
        throw Object.assign(new Error('restricted'), { code: 'restricted_resource' });
      },
    });

    const notFound = await runNotionValidation({
      target: 'ideas-db',
      requiredValue: 'db-id',
      operation: async () => {
        throw Object.assign(new Error('missing db'), { code: 'object_not_found' });
      },
    });

    expect(unauthorized.ok).toBe(false);
    expect(restricted.ok).toBe(false);
    expect(notFound.ok).toBe(false);

    expect(unauthorized.ok ? null : unauthorized.diagnostic).toMatchObject({
      category: 'auth-permission',
      code: 'notion.auth_permission.unauthorized',
    });
    expect(restricted.ok ? null : restricted.diagnostic).toMatchObject({
      category: 'auth-permission',
      code: 'notion.auth_permission.restricted_resource',
    });
    expect(notFound.ok ? null : notFound.diagnostic).toMatchObject({
      category: 'auth-permission',
      code: 'notion.auth_permission.object_not_found',
    });
  });

  it('classifies fetch/network failures as transport with stable troubleshooting text', async () => {
    const transport = await runNotionValidation({
      target: 'api-key',
      requiredValue: 'secret',
      operation: async () => {
        throw new Error('fetch failed');
      },
    });

    expect(transport.ok).toBe(false);
    expect(transport.ok ? null : transport.diagnostic).toMatchObject({
      category: 'transport',
      code: 'notion.transport.fetch_failed',
      summary: 'Notion request failed due to network or transport issues.',
      troubleshooting: [
        'Verify network access, VPN/proxy settings, and TLS interception rules.',
        'If using Node <22.21.0, upgrade Node and retry.',
        'Run session-vault doctor to re-check connectivity diagnostics.',
      ],
    });
  });
});
