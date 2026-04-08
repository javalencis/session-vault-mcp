import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NotionVaultClient } from '../../notion/client.js';

const inputSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  sessionKey: z.string().min(1).optional(),
});

type CaptureIdeaInput = z.infer<typeof inputSchema>;

function textResult(text: string, isError = false, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    isError,
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function executeCaptureIdea(
  notionClient: NotionVaultClient,
  rawInput: unknown,
): Promise<CallToolResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return textResult(
      `Invalid input for capture_idea: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
        .join('; ')}`,
      true,
    );
  }

  const input: CaptureIdeaInput = parsed.data;

  try {
    const existingIdeas = await notionClient.searchMemories(input.title, 'idea', 20);
    const similarIdea = existingIdeas.find((candidate) => {
      if (!('title' in candidate) || typeof candidate.title !== 'string') {
        return false;
      }
      return normalize(candidate.title) === normalize(input.title);
    });

    let linkedSessionId: string | undefined;
    if (input.sessionKey) {
      const session = await notionClient.querySessionByKey(input.sessionKey);
      if (!session) {
        return textResult(
          `Session with key "${input.sessionKey}" was not found, so the idea could not be linked.`,
          true,
        );
      }
      linkedSessionId = session.id;
    }

    const enrichedDescription = [input.description, input.confidence !== undefined ? `Confidence: ${input.confidence}` : '']
      .filter(Boolean)
      .join('\n');

    const created = await notionClient.createIdea({
      title: input.title,
      description: enrichedDescription,
      tags: input.tags,
      sessionId: linkedSessionId,
    });

    const warnings: string[] = [];
    if (similarIdea) {
      warnings.push(
        `Similar idea detected: "${similarIdea.title}" (${similarIdea.url ?? similarIdea.id}). Saved anyway.`,
      );
    }

    return textResult(
      warnings.length > 0
        ? `Idea captured with warnings. notion_url=${created.url}; warnings=${warnings.join(' | ')}`
        : `Idea captured successfully. notion_url=${created.url}`,
      false,
      {
        notion_url: created.url,
        linkedSession: input.sessionKey ?? null,
        warnings,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return textResult(
      `Failed to capture idea. WHY: ${message}. Check Notion connectivity and database IDs.`,
      true,
    );
  }
}

export function registerCaptureIdeaTool(server: McpServer, notionClient: NotionVaultClient): void {
  server.registerTool(
    'capture_idea',
    {
      title: 'Capture Idea',
      description: 'Capture an idea in Notion, optionally linked to a session.',
      inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        tags: z.array(z.string()).optional(),
        sessionKey: z.string().optional(),
      },
    },
    async (args) => executeCaptureIdea(notionClient, args),
  );
}
