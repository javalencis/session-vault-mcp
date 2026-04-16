import { describe, expect, it, vi } from 'vitest';
import { executeUpdateSession } from '../../src/mcp/tools/update-session.js';

function makeNotionClient() {
  return {
    querySessionByKey: vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Existing title',
      summary: 'Existing summary',
      url: 'https://notion.so/session-1',
    }),
    updateSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Existing title',
      summary: 'Existing summary',
      url: 'https://notion.so/session-1',
    }),
  };
}

describe('update_session tool', () => {
  it('accepts session_key alias from save_session output', async () => {
    const notionClient = makeNotionClient();

    const result = await executeUpdateSession(notionClient as any, {
      session_key: 'sv-123-test',
      status: 'in-progress',
    });

    expect(result.isError).toBe(false);
    expect(notionClient.querySessionByKey).toHaveBeenCalledWith('sv-123-test');
    expect(notionClient.updateSession).toHaveBeenCalledWith('sv-123-test', expect.any(Object), undefined);
  });

  it('returns a validation error when no session key is provided', async () => {
    const notionClient = makeNotionClient();

    const result = await executeUpdateSession(notionClient as any, {
      status: 'done',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0] && 'text' in result.content[0] ? result.content[0].text : '').toContain(
      'sessionKey or session_key is required',
    );
  });
});
