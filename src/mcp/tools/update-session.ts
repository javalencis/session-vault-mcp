import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NotionVaultClient } from '../../notion/client.js';
import type { SessionInput } from '../../types.js';

const inputSchema = z
  .object({
    sessionKey: z.string().min(1).optional(),
    session_key: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    goal: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    decisions: z.array(z.string().min(1)).optional(),
    nextSteps: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    status: z.string().min(1).optional(),
    appendContent: z.string().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.sessionKey && !input.session_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sessionKey'],
        message: 'sessionKey or session_key is required',
      });
    }
  })
  .transform(({ session_key, sessionKey, ...rest }) => ({
    ...rest,
    sessionKey: sessionKey ?? session_key!,
  }));

type UpdateSessionInput = z.infer<typeof inputSchema>;

function textResult(text: string, isError = false, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    isError,
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

export async function executeUpdateSession(
  notionClient: NotionVaultClient,
  rawInput: unknown,
): Promise<CallToolResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return textResult(
      `Invalid input for update_session: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
        .join('; ')}`,
      true,
    );
  }

  const input: UpdateSessionInput = parsed.data;

  try {
    const existing = await notionClient.querySessionByKey(input.sessionKey);
    if (!existing) {
      return textResult(
        `Session not found for sessionKey="${input.sessionKey}". Verify the key and try again.`,
        true,
      );
    }

    const updates: Partial<SessionInput> = {
      title: input.title,
      goal: input.goal,
      summary: input.summary,
      decisions: input.decisions,
      nextSteps: input.nextSteps,
      tags: input.tags,
      status: input.status,
    };

    const updated = await notionClient.updateSession(input.sessionKey, updates, input.appendContent);

    return textResult(
      `Session updated successfully. session_key=${input.sessionKey}; notion_url=${updated.url}`,
      false,
      {
        notion_url: updated.url,
        updated_fields: {
          title: input.title,
          goal: input.goal,
          summary: input.summary,
          decisions: input.decisions,
          nextSteps: input.nextSteps,
          tags: input.tags,
          status: input.status,
          appendContent: input.appendContent,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return textResult(
      `Failed to update session ${input.sessionKey}. WHY: ${message}. Ensure Notion is reachable and IDs are valid.`,
      true,
    );
  }
}

export function registerUpdateSessionTool(server: McpServer, notionClient: NotionVaultClient): void {
  server.registerTool(
    'update_session',
    {
      title: 'Update Session',
      description: 'Update a session by key and optionally append additional content.',
      inputSchema: {
        sessionKey: z.string(),
        session_key: z.string().optional(),
        title: z.string().optional(),
        goal: z.string().optional(),
        summary: z.string().optional(),
        decisions: z.array(z.string()).optional(),
        nextSteps: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        status: z.string().optional(),
        appendContent: z.string().optional(),
      },
    },
    async (args) => executeUpdateSession(notionClient, args),
  );
}
