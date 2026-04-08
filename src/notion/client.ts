import { Client } from '@notionhq/client';
import { z } from 'zod';
import { loadConfig } from '../config/load.js';
import type { IdeaInput, IdeaRecord, SessionInput, SessionRecord, SessionVaultConfig } from '../types.js';
import { ConfigError, NotFoundError, NotionApiError } from './errors.js';
import {
  mapIdeaInputToNotionProperties,
  mapNotionPageToIdeaRecord,
  mapNotionPageToSessionRecord,
  mapSessionInputToNotionProperties,
} from './mapper.js';
import { ideasDatabaseSchema, sessionsDatabaseSchema } from './schemas.js';

const searchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['session', 'idea', 'all']).default('all'),
  limit: z.number().int().positive().max(50).default(10),
});

type NotionSdk = {
  pages: {
    create: (payload: any) => Promise<any>;
    update: (payload: any) => Promise<any>;
  };
  databases: {
    query: (payload: any) => Promise<{ results: any[] }>;
    retrieve: (payload: any) => Promise<any>;
  };
  blocks: {
    children: {
      append: (payload: any) => Promise<any>;
    };
  };
};

export class NotionVaultClient {
  private readonly notion: NotionSdk;
  private readonly config: SessionVaultConfig;

  constructor(config?: SessionVaultConfig, notionClient?: NotionSdk) {
    this.config = config ?? loadConfig();

    if (!this.config.notionApiKey) {
      throw new ConfigError('Missing Notion API key');
    }

    this.notion = notionClient ?? (new Client({ auth: this.config.notionApiKey }) as unknown as NotionSdk);
  }

  async createSession(input: SessionInput): Promise<SessionRecord> {
    if (!this.config.notionSessionsDbId) {
      throw new ConfigError('Missing NOTION_SESSIONS_DB_ID');
    }

    try {
      const created = await this.notion.pages.create({
        parent: { database_id: this.config.notionSessionsDbId },
        properties: mapSessionInputToNotionProperties(input),
      });
      return mapNotionPageToSessionRecord(created);
    } catch (error) {
      throw new NotionApiError('Failed to create session in Notion', error);
    }
  }

  async updateSession(
    sessionKey: string,
    updates: Partial<SessionInput>,
    appendContent?: string,
  ): Promise<SessionRecord> {
    const existing = await this.querySessionByKey(sessionKey);
    if (!existing) {
      throw new NotFoundError(`Session not found for key: ${sessionKey}`);
    }

    try {
      const updated = await this.notion.pages.update({
        page_id: existing.id,
        properties: mapSessionInputToNotionProperties({ ...existing, ...updates, sessionKey }),
      });

      if (appendContent && appendContent.trim()) {
        await this.notion.blocks.children.append({
          block_id: existing.id,
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: appendContent } }],
              },
            },
          ],
        });
      }

      return mapNotionPageToSessionRecord(updated);
    } catch (error) {
      throw new NotionApiError(`Failed to update session ${sessionKey}`, error);
    }
  }

  async querySessionByKey(sessionKey: string): Promise<SessionRecord | null> {
    if (!this.config.notionSessionsDbId) {
      throw new ConfigError('Missing NOTION_SESSIONS_DB_ID');
    }

    try {
      const response = await this.notion.databases.query({
        database_id: this.config.notionSessionsDbId,
        filter: {
          property: sessionsDatabaseSchema.sessionKey.name,
          rich_text: { equals: sessionKey },
        },
        page_size: 1,
      });

      if (!response.results.length) {
        return null;
      }

      return mapNotionPageToSessionRecord(response.results[0]);
    } catch (error) {
      throw new NotionApiError(`Failed to query session by key: ${sessionKey}`, error);
    }
  }

  async queryRecentSessions(hours: number): Promise<SessionRecord[]> {
    if (!this.config.notionSessionsDbId) {
      throw new ConfigError('Missing NOTION_SESSIONS_DB_ID');
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
      const response = await this.notion.databases.query({
        database_id: this.config.notionSessionsDbId,
        filter: {
          timestamp: 'created_time',
          created_time: { on_or_after: since },
        },
      });

      return response.results.map(mapNotionPageToSessionRecord);
    } catch (error) {
      throw new NotionApiError(`Failed to query recent sessions for ${hours}h`, error);
    }
  }

  async validateStartupSchema(): Promise<string[]> {
    const warnings: string[] = [];

    await this.validateDatabase(
      'Sessions',
      this.config.notionSessionsDbId,
      [
        { name: sessionsDatabaseSchema.title.name, type: sessionsDatabaseSchema.title.type },
        { name: sessionsDatabaseSchema.sessionKey.name, type: sessionsDatabaseSchema.sessionKey.type },
      ],
      warnings,
    );

    await this.validateDatabase(
      'Ideas',
      this.config.notionIdeasDbId,
      [{ name: ideasDatabaseSchema.title.name, type: ideasDatabaseSchema.title.type }],
      warnings,
    );

    return warnings;
  }

  private async validateDatabase(
    label: 'Sessions' | 'Ideas',
    databaseId: string | undefined,
    requiredProperties: Array<{ name: string; type: string }>,
    warnings: string[],
  ): Promise<void> {
    if (!databaseId) {
      warnings.push(`${label} database ID is missing; startup schema validation skipped.`);
      return;
    }

    try {
      const database = (await this.notion.databases.retrieve({ database_id: databaseId })) as {
        properties?: Record<string, { type?: string }>;
      };

      const properties = database.properties ?? {};

      for (const requirement of requiredProperties) {
        const property = properties[requirement.name];
        if (!property) {
          warnings.push(
            `${label} database is missing required property "${requirement.name}" (db: ${databaseId}).`,
          );
          continue;
        }

        if (property.type !== requirement.type) {
          warnings.push(
            `${label} property "${requirement.name}" has type "${property.type ?? 'unknown'}" but expected "${requirement.type}" (db: ${databaseId}).`,
          );
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Notion error';
      warnings.push(
        `Could not validate ${label} database (${databaseId}); check access and integration permissions. Reason: ${reason}`,
      );
    }
  }

  async createIdea(input: IdeaInput): Promise<IdeaRecord> {
    if (!this.config.notionIdeasDbId) {
      throw new ConfigError('Missing NOTION_IDEAS_DB_ID');
    }

    try {
      const created = await this.notion.pages.create({
        parent: { database_id: this.config.notionIdeasDbId },
        properties: mapIdeaInputToNotionProperties(input),
      });
      return mapNotionPageToIdeaRecord(created);
    } catch (error) {
      throw new NotionApiError('Failed to create idea in Notion', error);
    }
  }

  async searchMemories(
    query: string,
    type: 'session' | 'idea' | 'all' = 'all',
    limit = 10,
  ): Promise<Array<SessionRecord | IdeaRecord>> {
    const parsed = searchSchema.parse({ query, type, limit });

    try {
      const results: Array<SessionRecord | IdeaRecord> = [];

      if (parsed.type === 'session' || parsed.type === 'all') {
        if (!this.config.notionSessionsDbId) {
          throw new ConfigError('Missing NOTION_SESSIONS_DB_ID');
        }
        const sessions = await this.notion.databases.query({
          database_id: this.config.notionSessionsDbId,
          filter: {
            or: [
              { property: sessionsDatabaseSchema.title.name, title: { contains: parsed.query } },
              { property: sessionsDatabaseSchema.summary.name, rich_text: { contains: parsed.query } },
            ],
          },
          page_size: parsed.limit,
        });
        results.push(...sessions.results.map(mapNotionPageToSessionRecord));
      }

      if (parsed.type === 'idea' || parsed.type === 'all') {
        if (!this.config.notionIdeasDbId) {
          throw new ConfigError('Missing NOTION_IDEAS_DB_ID');
        }
        const ideas = await this.notion.databases.query({
          database_id: this.config.notionIdeasDbId,
          filter: {
            or: [
              { property: ideasDatabaseSchema.title.name, title: { contains: parsed.query } },
              { property: ideasDatabaseSchema.description.name, rich_text: { contains: parsed.query } },
            ],
          },
          page_size: parsed.limit,
        });
        results.push(...ideas.results.map(mapNotionPageToIdeaRecord));
      }

      return results.slice(0, parsed.limit);
    } catch (error) {
      if (error instanceof ConfigError || error instanceof z.ZodError) {
        throw error;
      }
      throw new NotionApiError(`Failed to search memories for query: ${query}`, error);
    }
  }
}
