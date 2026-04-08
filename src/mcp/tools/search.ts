import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NotionVaultClient } from '../../notion/client.js';

const inputSchema = z.object({
  query: z.string().min(1, 'query is required'),
  type: z.enum(['session', 'idea', 'all']).default('all'),
  limit: z.number().int().positive().max(50).default(10),
});

function textResult(text: string, isError = false, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    isError,
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function inferType(result: Record<string, unknown>): 'session' | 'idea' {
  if ('sessionId' in result) {
    return 'idea';
  }
  return 'session';
}

export async function executeSearchMemories(
  notionClient: NotionVaultClient,
  rawInput: unknown,
): Promise<CallToolResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return textResult(
      `Invalid input for search_memories: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
        .join('; ')}`,
      true,
    );
  }

  const { query, type, limit } = parsed.data;

  try {
    const records = await notionClient.searchMemories(query, type, limit);
    const results = records.map((record) => {
      const typedRecord = record as unknown as Record<string, unknown>;
      const resultType = inferType(typedRecord);
      return {
        title: String(typedRecord.title ?? ''),
        date: String(typedRecord.createdAt ?? ''),
        summary: resultType === 'session' ? String(typedRecord.summary ?? '') : undefined,
        description: resultType === 'idea' ? String(typedRecord.description ?? '') : undefined,
        url: String(typedRecord.url ?? ''),
        type: resultType,
      };
    });

    return textResult(
      results.length > 0
        ? `Found ${results.length} result(s) for "${query}".`
        : `No results found for "${query}".`,
      false,
      { results },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return textResult(
      `Search failed. WHY: ${message}. Verify Notion access and IDs before retrying.`,
      true,
    );
  }
}

export function registerSearchTool(server: McpServer, notionClient: NotionVaultClient): void {
  server.registerTool(
    'search_memories',
    {
      title: 'Search Memories',
      description: 'Search sessions and ideas in Notion memory stores.',
      inputSchema: {
        query: z.string(),
        type: z.enum(['session', 'idea', 'all']).optional(),
        limit: z.number().int().positive().max(50).optional(),
      },
    },
    async (args) => executeSearchMemories(notionClient, args),
  );
}
