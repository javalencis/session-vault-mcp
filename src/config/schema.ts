import { z } from 'zod';

const optionalNotionId = z.string().trim().min(1).optional();

export const configSchema = z.object({
  notionApiKey: z.string().trim().min(1, 'NOTION_API_KEY is required'),
  notionSessionsDbId: optionalNotionId,
  notionIdeasDbId: optionalNotionId,
  notionParentPageId: optionalNotionId,
});

export const globalConfigSchema = z
  .object({
    notionApiKey: z.string().trim().min(1).optional(),
    notionSessionsDbId: optionalNotionId,
    notionIdeasDbId: optionalNotionId,
    notionParentPageId: optionalNotionId,
  })
  .strict();

export type ConfigSchema = z.infer<typeof configSchema>;
export type GlobalConfigSchema = z.infer<typeof globalConfigSchema>;
