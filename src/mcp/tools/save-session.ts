import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NotionVaultClient } from '../../notion/client.js';
import { checkDuplicate } from '../../scoring/dedup.js';
import { scoreSession } from '../../scoring/quality.js';

const inputSchema = z.object({
  title: z.string().min(1, 'title is required'),
  goal: z.string().min(1).optional(),
  summary: z.string().min(1, 'summary is required'),
  decisions: z.array(z.string().min(1)).optional(),
  nextSteps: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  project: z.string().min(1).optional(),
  source: z.enum(['opencode', 'claude-code', 'manual']).optional(),
});

type SaveSessionInput = z.infer<typeof inputSchema>;

function textResult(text: string, isError = false, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    isError,
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function generateSessionKey(): string {
  const random = Math.random().toString(36).slice(2, 6);
  return `sv-${Date.now()}-${random}`;
}

export async function executeSaveSession(
  notionClient: NotionVaultClient,
  rawInput: unknown,
): Promise<CallToolResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return textResult(
      `Invalid input for save_session: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
        .join('; ')}`,
      true,
    );
  }

  const input: SaveSessionInput = parsed.data;
  const quality = scoreSession(input);

  if (quality.tier === 'reject') {
    return textResult(
      `Session rejected by quality gate. Reasons: ${quality.reasons.join(' | ')}`,
      true,
      {
        quality_score: quality.score,
        tier: quality.tier,
        reasons: quality.reasons,
      },
    );
  }

  try {
    const recentSessions = await notionClient.queryRecentSessions(24);
    const duplicate = checkDuplicate(input.title, recentSessions);
    const sessionKey = generateSessionKey();

    const created = await notionClient.createSession({
      ...input,
      sessionKey,
    });

    const warnings: string[] = [];

    if (quality.tier === 'low-quality') {
      warnings.push(`Saved with low-quality warning: ${quality.reasons.join(' | ')}`);
    }

    if (duplicate.isDuplicate) {
      warnings.push(
        `Possible duplicate detected with session "${duplicate.similarSession?.title}" (${duplicate.similarSession?.url ?? duplicate.similarSession?.id}). Saved anyway.`,
      );
    }

    const response = {
      session_key: sessionKey,
      notion_url: created.url,
      quality_score: quality.score,
      tier: quality.tier,
      reasons: quality.reasons,
      warnings,
    };

    return textResult(
      warnings.length > 0
        ? `Session saved with warnings. session_key=${sessionKey}; notion_url=${created.url}; warnings=${warnings.join(' | ')}`
        : `Session saved successfully. session_key=${sessionKey}; notion_url=${created.url}`,
      false,
      response,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return textResult(
      `Failed to save session. WHY: ${message}. Check Notion credentials/database IDs and network access.`,
      true,
    );
  }
}

export function registerSaveSessionTool(server: McpServer, notionClient: NotionVaultClient): void {
  server.registerTool(
    'save_session',
    {
      title: 'Save Session',
      description: 'Save a coding session to Notion with internal quality scoring and duplicate checks.',
      inputSchema: {
        title: z.string(),
        goal: z.string().optional(),
        summary: z.string(),
        decisions: z.array(z.string()).optional(),
        nextSteps: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        project: z.string().optional(),
        source: z.enum(['opencode', 'claude-code', 'manual']).optional(),
      },
    },
    async (args) => executeSaveSession(notionClient, args),
  );
}
