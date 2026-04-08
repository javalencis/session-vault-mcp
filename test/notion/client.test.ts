import { describe, expect, it, vi } from 'vitest';
import { NotionVaultClient } from '../../src/notion/client.js';
import { NotFoundError, NotionApiError } from '../../src/notion/errors.js';
import type { SessionVaultConfig } from '../../src/types.js';

function makeSessionPage(id = 'session-1') {
  return {
    id,
    created_time: '2026-04-07T00:00:00.000Z',
    last_edited_time: '2026-04-07T00:00:00.000Z',
    url: `https://notion.so/${id}`,
    properties: {
      Title: { title: [{ plain_text: 'Implement Notion client' }] },
      'Session Key': { rich_text: [{ plain_text: 'implement-notion-client' }] },
      Goal: { rich_text: [{ plain_text: 'Ship phase 2' }] },
      Summary: { rich_text: [{ plain_text: 'Summary text' }] },
      Decisions: { rich_text: [{ plain_text: 'Decision A\nDecision B' }] },
      'Next Steps': { rich_text: [{ plain_text: 'Step A\nStep B' }] },
      Tags: { multi_select: [{ name: 'mvp' }] },
      Project: { rich_text: [{ plain_text: 'session-vault' }] },
      Source: { select: { name: 'opencode' } },
    },
  };
}

function makeIdeaPage(id = 'idea-1') {
  return {
    id,
    created_time: '2026-04-07T00:00:00.000Z',
    last_edited_time: '2026-04-07T00:00:00.000Z',
    url: `https://notion.so/${id}`,
    properties: {
      Title: { title: [{ plain_text: 'Idea title' }] },
      Description: { rich_text: [{ plain_text: 'Idea description' }] },
      Tags: { multi_select: [{ name: 'idea' }] },
      Project: { rich_text: [{ plain_text: 'session-vault' }] },
      'Session Relation': { relation: [{ id: 'session-1' }] },
    },
  };
}

function makeClientMocks() {
  return {
    pages: {
      create: vi.fn(),
      update: vi.fn(),
    },
    databases: {
      query: vi.fn(),
      retrieve: vi.fn(),
    },
    blocks: {
      children: {
        append: vi.fn(),
      },
    },
  };
}

const config: SessionVaultConfig = {
  notionApiKey: 'secret',
  notionSessionsDbId: 'sessions-db',
  notionIdeasDbId: 'ideas-db',
};

describe('NotionVaultClient', () => {
  it('creates session and maps response', async () => {
    const notion = makeClientMocks();
    notion.pages.create.mockResolvedValue(makeSessionPage());

    const client = new NotionVaultClient(config, notion as any);
    const created = await client.createSession({
      title: 'Implement Notion client',
      summary: 'Summary text',
      source: 'opencode',
    });

    expect(notion.pages.create).toHaveBeenCalledOnce();
    expect(created.id).toBe('session-1');
    expect(created.title).toBe('Implement Notion client');
  });

  it('updates session and appends block content', async () => {
    const notion = makeClientMocks();
    notion.databases.query.mockResolvedValue({ results: [makeSessionPage()] });
    notion.pages.update.mockResolvedValue(makeSessionPage('session-1-updated'));

    const client = new NotionVaultClient(config, notion as any);
    const updated = await client.updateSession(
      'implement-notion-client',
      { summary: 'Updated summary' },
      'Append this update',
    );

    expect(notion.pages.update).toHaveBeenCalledOnce();
    expect(notion.blocks.children.append).toHaveBeenCalledOnce();
    expect(updated.id).toBe('session-1-updated');
  });

  it('returns null when session key is not found', async () => {
    const notion = makeClientMocks();
    notion.databases.query.mockResolvedValue({ results: [] });

    const client = new NotionVaultClient(config, notion as any);
    await expect(client.querySessionByKey('missing')).resolves.toBeNull();
  });

  it('throws not found on update when key does not exist', async () => {
    const notion = makeClientMocks();
    notion.databases.query.mockResolvedValue({ results: [] });

    const client = new NotionVaultClient(config, notion as any);
    await expect(client.updateSession('missing', { summary: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('queries recent sessions from time window', async () => {
    const notion = makeClientMocks();
    notion.databases.query.mockResolvedValue({ results: [makeSessionPage('session-7')] });

    const client = new NotionVaultClient(config, notion as any);
    const records = await client.queryRecentSessions(24);

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('session-7');
  });

  it('creates idea and links to session when provided', async () => {
    const notion = makeClientMocks();
    notion.pages.create.mockResolvedValue(makeIdeaPage());

    const client = new NotionVaultClient(config, notion as any);
    const idea = await client.createIdea({
      title: 'Idea title',
      description: 'Idea description',
      sessionId: 'session-1',
    });

    expect(notion.pages.create).toHaveBeenCalledOnce();
    expect(idea.sessionId).toBe('session-1');
  });

  it('searches across sessions and ideas', async () => {
    const notion = makeClientMocks();
    notion.databases.query
      .mockResolvedValueOnce({ results: [makeSessionPage()] })
      .mockResolvedValueOnce({ results: [makeIdeaPage()] });

    const client = new NotionVaultClient(config, notion as any);
    const results = await client.searchMemories('notion', 'all', 10);

    expect(notion.databases.query).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });

  it('wraps notion api failures in NotionApiError', async () => {
    const notion = makeClientMocks();
    notion.pages.create.mockRejectedValue(new Error('network boom'));

    const client = new NotionVaultClient(config, notion as any);
    await expect(client.createSession({ title: 'A', summary: 'B' })).rejects.toBeInstanceOf(NotionApiError);
  });

  it('validates startup schemas with required properties', async () => {
    const notion = makeClientMocks();
    notion.databases.retrieve
      .mockResolvedValueOnce({
        properties: {
          Title: { type: 'title' },
          'Session Key': { type: 'rich_text' },
        },
      })
      .mockResolvedValueOnce({
        properties: {
          Title: { type: 'title' },
        },
      });

    const client = new NotionVaultClient(config, notion as any);
    const warnings = await client.validateStartupSchema();

    expect(warnings).toEqual([]);
    expect(notion.databases.retrieve).toHaveBeenCalledTimes(2);
  });

  it('returns warnings when databases are inaccessible or missing properties', async () => {
    const notion = makeClientMocks();
    notion.databases.retrieve
      .mockResolvedValueOnce({
        properties: {
          Title: { type: 'title' },
        },
      })
      .mockRejectedValueOnce(new Error('forbidden'));

    const client = new NotionVaultClient(config, notion as any);
    const warnings = await client.validateStartupSchema();

    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.includes('Session Key'))).toBe(true);
    expect(warnings.some((w) => w.includes('Could not validate Ideas database'))).toBe(true);
  });
});
