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
  dataSources?: {
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
  private sessionsDataSourceId?: string;
  private ideasDataSourceId?: string;

  constructor(config?: SessionVaultConfig, notionClient?: NotionSdk) {
    this.config = config ?? loadConfig();

    if (!this.config.notionApiKey) {
      throw new ConfigError('Missing Notion API key');
    }

    this.notion = notionClient ?? (new Client({ auth: this.config.notionApiKey }) as unknown as NotionSdk);
  }

  private async resolveDataSourceId(id: string | undefined, cacheKey: 'sessions' | 'ideas'): Promise<string> {
    if (!id) {
      throw new ConfigError(`Missing ${cacheKey === 'sessions' ? 'NOTION_SESSIONS_DB_ID' : 'NOTION_IDEAS_DB_ID'}`);
    }

    if (cacheKey === 'sessions' && this.sessionsDataSourceId) {
      return this.sessionsDataSourceId;
    }
    if (cacheKey === 'ideas' && this.ideasDataSourceId) {
      return this.ideasDataSourceId;
    }

    // New API: data source is the real queryable parent. Existing configs may still store database IDs.
    let resolvedId = id;

    if (this.notion.dataSources?.retrieve) {
      try {
        await this.notion.dataSources.retrieve({ data_source_id: id });
      } catch {
        const database = await this.notion.databases.retrieve({ database_id: id });
        resolvedId = database?.data_sources?.[0]?.id ?? id;
      }
    }

    if (cacheKey === 'sessions') {
      this.sessionsDataSourceId = resolvedId;
    } else {
      this.ideasDataSourceId = resolvedId;
    }

    return resolvedId;
  }

  async createSession(input: SessionInput): Promise<SessionRecord> {
    try {
      const dataSourceId = await this.resolveDataSourceId(this.config.notionSessionsDbId, 'sessions');
      const created = await this.notion.pages.create({
        parent: { data_source_id: dataSourceId },
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
      const nextInput = {
        ...existing,
        ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
        sessionKey,
      };

      const updatePage = async (input: SessionInput) =>
        this.notion.pages.update({
          page_id: existing.id,
          properties: mapSessionInputToNotionProperties(input),
        });

      let updated;

      try {
        updated = await updatePage(nextInput);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';

        // Older Notion databases may not have the optional Status property yet.
        if (nextInput.status && message.includes('Status is not a property that exists.')) {
          const { status: _ignored, ...withoutStatus } = nextInput;
          updated = await updatePage(withoutStatus);
        } else {
          throw error;
        }
      }

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
    try {
      const dataSourceId = await this.resolveDataSourceId(this.config.notionSessionsDbId, 'sessions');
      const queryApi = this.notion.dataSources?.query ?? this.notion.databases.query;
      const idKey = this.notion.dataSources?.query ? 'data_source_id' : 'database_id';
      const response = await queryApi({
        [idKey]: dataSourceId,
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
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
      const dataSourceId = await this.resolveDataSourceId(this.config.notionSessionsDbId, 'sessions');
      const queryApi = this.notion.dataSources?.query ?? this.notion.databases.query;
      const idKey = this.notion.dataSources?.query ? 'data_source_id' : 'database_id';
      const response = await queryApi({
        [idKey]: dataSourceId,
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
      Object.values(sessionsDatabaseSchema).map(({ name, type }) => ({ name, type })),
      warnings,
    );

    await this.validateDatabase(
      'Ideas',
      this.config.notionIdeasDbId,
      Object.values(ideasDatabaseSchema).map(({ name, type }) => ({ name, type })),
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
      const dataSourceId = await this.resolveDataSourceId(databaseId, label === 'Sessions' ? 'sessions' : 'ideas');
      const database = (this.notion.dataSources?.retrieve
        ? await this.notion.dataSources.retrieve({ data_source_id: dataSourceId })
        : await this.notion.databases.retrieve({ database_id: databaseId })) as {
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
    try {
      const dataSourceId = await this.resolveDataSourceId(this.config.notionIdeasDbId, 'ideas');
      const created = await this.notion.pages.create({
        parent: { data_source_id: dataSourceId },
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
        const dataSourceId = await this.resolveDataSourceId(this.config.notionSessionsDbId, 'sessions');
        const queryApi = this.notion.dataSources?.query ?? this.notion.databases.query;
        const idKey = this.notion.dataSources?.query ? 'data_source_id' : 'database_id';
        const sessions = await queryApi({
          [idKey]: dataSourceId,
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
        const dataSourceId = await this.resolveDataSourceId(this.config.notionIdeasDbId, 'ideas');
        const queryApi = this.notion.dataSources?.query ?? this.notion.databases.query;
        const idKey = this.notion.dataSources?.query ? 'data_source_id' : 'database_id';
        const ideas = await queryApi({
          [idKey]: dataSourceId,
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
