import { describe, expect, it, vi } from 'vitest';
import { executeSaveSession } from '../../src/mcp/tools/save-session.js';

function makeNotionClient() {
  return {
    queryRecentSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      url: 'https://notion.so/session-1',
      title: 'Saved title',
      summary: 'Saved summary',
    }),
  };
}

describe('save_session tool', () => {
  it('rejects low-signal sessions and does not persist', async () => {
    const notionClient = makeNotionClient();

    const result = await executeSaveSession(notionClient as any, {
      title: 'test',
      summary: 'short summary',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0] && 'text' in result.content[0] ? result.content[0].text : '').toContain(
      'Session rejected by quality gate',
    );
    expect(notionClient.createSession).not.toHaveBeenCalled();
  });

  it('saves low-quality sessions with warning payload', async () => {
    const notionClient = makeNotionClient();

    const result = await executeSaveSession(notionClient as any, {
      title: 'Useful title',
      summary: 'A concise but still informative summary to clear fifty chars.',
    });

    expect(result.isError).toBe(false);
    expect(notionClient.createSession).toHaveBeenCalledOnce();
    expect((result.structuredContent as any)?.tier).toBe('low-quality');
    expect((result.structuredContent as any)?.warnings?.length).toBeGreaterThan(0);
  });

  it('warns on duplicate but still saves', async () => {
    const notionClient = makeNotionClient();
    notionClient.queryRecentSessions.mockResolvedValue([
      {
        id: 'existing-1',
        title: 'Implement MCP server setup',
        summary: 'existing summary',
        url: 'https://notion.so/existing-1',
      },
    ]);

    const result = await executeSaveSession(notionClient as any, {
      title: 'Implement MCP server setup',
      summary:
        'Implemented the MCP server bootstrap, registered all required tools, and validated Notion integration paths.',
      decisions: ['Keep tool registration isolated per file'],
      nextSteps: ['Add end-to-end CLI wiring'],
    });

    expect(result.isError).toBe(false);
    expect(notionClient.createSession).toHaveBeenCalledOnce();
    expect((result.structuredContent as any)?.warnings?.[0]).toContain('Possible duplicate detected');
  });

  it('saves a valid session, generates a session key, and returns structured payload', async () => {
    const notionClient = makeNotionClient();

    const result = await executeSaveSession(notionClient as any, {
      title: 'Implement startup schema validation for MCP server',
      summary:
        'Added startup validation for Sessions and Ideas databases, with required property checks and warning-only behavior on failures.',
      decisions: ['Keep startup resilient and non-blocking'],
      nextSteps: ['Add tests for warning paths'],
      project: 'session-vault',
    });

    expect(result.isError).toBe(false);
    expect(notionClient.createSession).toHaveBeenCalledOnce();

    const createPayload = notionClient.createSession.mock.calls[0]?.[0];
    expect(createPayload?.sessionKey).toMatch(/^sv-\d+-[a-z0-9]{4}$/);

    const structured = result.structuredContent as any;
    expect(structured?.tier).toBe('save');
    expect(structured?.session_key).toMatch(/^sv-\d+-[a-z0-9]{4}$/);
    expect(structured?.notion_url).toBe('https://notion.so/session-1');
    expect(structured?.warnings).toEqual([]);
  });
});
